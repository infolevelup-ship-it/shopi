-- ============================================================================
-- El precio unitario lo pone el catálogo, no el navegador.
--
-- Hasta ahora `create_order`, `update_order` y `create_quote` recibían
-- `unit_price` dentro de p_items y lo usaban tal cual. Bloquear el campo en
-- pantalla no habría servido de nada: la acción del servidor sigue aceptando
-- lo que llegue, y el precio es exactamente el dato que no puede depender de
-- lo que mande el cliente.
--
-- El `unit_price` que venga en p_items se ignora. Se conserva en la firma para
-- no romper a los llamadores existentes.
-- ============================================================================

create or replace function catalog_unit_price(p_product products, p_price_list text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_precio numeric(14,2);
begin
  -- Si la lista elegida no tiene precio cargado se cae a la pública. Es lo
  -- que ya hacía la pantalla, y el formulario avisa cuando pasa; poner cero
  -- aquí sería regalar el producto.
  v_precio := case coalesce(p_price_list, 'publico')
    when 'profesional' then coalesce(p_product.price_professional, p_product.price_public)
    when 'salon'       then coalesce(p_product.price_salon, p_product.price_public)
    else p_product.price_public
  end;

  if v_precio is null then
    raise exception
      'El producto "%" (%) no tiene ningún precio en el catálogo, así que no se puede vender. Cárgalo en Siigo y vuelve a sincronizar.',
      p_product.name, p_product.code;
  end if;

  return v_precio;
end;
$$;

revoke execute on function catalog_unit_price(products, text) from public, anon;
grant execute on function catalog_unit_price(products, text) to authenticated;

-- El reemplazo se hace sobre la definición viva en vez de reescribir las tres
-- funciones enteras: son ~400 líneas de cálculo de totales, y volver a
-- teclearlas para cambiar una línea es la forma más fácil de introducir un
-- error de redondeo que nadie note hasta la declaración de IVA.
--
-- Si alguna vez la línea deja de existir, esto falla ruidosamente en lugar de
-- no hacer nada, que es el modo en que este tipo de migración suele engañar.
do $migracion$
declare
  v_nombre text;
  v_def text;
  v_nueva text;
  v_esperados int;
begin
  foreach v_nombre in array array['create_order', 'update_order', 'create_quote']
  loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_nombre;

    if v_def is null then
      raise exception 'No existe la función %', v_nombre;
    end if;

    -- Cada función asigna el precio dos veces: una para sumar los totales
    -- antes de insertar, y otra al escribir las líneas. Si no son exactamente
    -- dos, la función cambió y este parche ya no aplica.
    v_esperados := (length(v_def) - length(replace(v_def, 'v_unit_price := (v_item->>''unit_price'')::numeric;', ''))) /
                   length('v_unit_price := (v_item->>''unit_price'')::numeric;');
    if v_esperados <> 2 then
      raise exception 'En % se esperaban 2 asignaciones de unit_price y hay %', v_nombre, v_esperados;
    end if;

    v_nueva := replace(
      v_def,
      'v_unit_price := (v_item->>''unit_price'')::numeric;',
      'v_unit_price := catalog_unit_price(v_product, p_price_list);'
    );

    execute v_nueva;
  end loop;
end
$migracion$;
