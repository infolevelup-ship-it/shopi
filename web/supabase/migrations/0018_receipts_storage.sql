-- ============================================================================
-- Comprobantes de pago (doc 01 §17, doc 05 §12, doc 11 §80/§81).
--
-- La tabla `attachments` y el tope de 3 comprobantes por pedido existen desde
-- la Fase 1; lo que faltaba es dónde viven los archivos y quién puede verlos.
-- El bucket es privado: un comprobante de pago lleva datos bancarios del
-- cliente, así que nunca se sirve por URL pública — solo por URL firmada de
-- vida corta, y solo a quien la RLS deja leer la fila.
-- ============================================================================

-- ------------------------------------------------------------------ bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false,
  10485760,  -- 10 MB: una foto de celular cabe de sobra y acota el abuso
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convención de ruta dentro del bucket: orders/<order_id>/<uuid>.<ext>
-- El pedido va en la ruta a propósito: así la política de storage puede
-- decidir con las mismas reglas que ya gobiernan el pedido, sin una tabla
-- de permisos aparte.
create or replace function public.receipt_path_order_id(p_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_parts text[];
begin
  v_parts := storage.foldername(p_name);
  if array_length(v_parts, 1) is null or v_parts[1] <> 'orders' then
    return null;
  end if;
  -- Una ruta con un id malformado no es un error del servidor: es una ruta
  -- que simplemente no corresponde a ningún pedido.
  begin
    return v_parts[2]::uuid;
  exception when others then
    return null;
  end;
end;
$$;

-- ------------------------------------------------------- políticas storage
-- Leer: cualquier usuario WOW activo, igual que `attachments_select` (Fase 1).
-- La vendedora sube y bodega verifica; que el archivo fuera más restringido
-- que su propia fila de metadatos solo produciría enlaces rotos.
-- Postgres otorga EXECUTE a PUBLIC y por separado a anon/authenticated al
-- crear la función; hay que revocar de ambos. `authenticated` sí lo necesita:
-- las políticas de storage se evalúan con el rol de quien consulta.
revoke execute on function public.receipt_path_order_id(text) from public, anon;
grant execute on function public.receipt_path_order_id(text) to authenticated;

create policy receipts_select on storage.objects for select
  using (
    bucket_id = 'receipts'
    and public.current_wow_role() is not null
  );

-- Subir: solo bajo orders/<id>/ y solo si ese pedido es visible para quien
-- sube. La RLS de `orders` decide eso — una vendedora solo ve los suyos,
-- bodega y supervisión los ven todos. No hace falta repetir esa lógica aquí.
create policy receipts_insert on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and public.current_wow_role() is not null
    and exists (
      select 1 from public.orders o
      where o.id = public.receipt_path_order_id(name)
    )
  );

-- Borrar: la vendedora dueña del pedido mientras todavía puede editarlo, o
-- supervisión. Un comprobante ya revisado por bodega no se borra: es la
-- prueba de que el pago entró.
create policy receipts_delete on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (
      public.current_wow_role() in ('SUPERVISOR', 'ADMIN')
      or exists (
        select 1 from public.orders o
        where o.id = public.receipt_path_order_id(name)
          and o.seller_id = public.current_wow_user_id()
          and o.status in ('DRAFT', 'RETURNED_TO_SELLER')
      )
    )
  );

-- Sin política de UPDATE a propósito: los archivos son inmutables.
-- "Reemplazar" es borrar y volver a subir, y así queda registro de ambas
-- cosas en vez de un archivo que cambió de contenido sin dejar rastro.

-- --------------------------------------------------- attachments: borrado
-- La Fase 1 dejó `attachments` con select e insert pero sin delete, así que
-- borrar una fila no daba error: simplemente no afectaba ninguna fila. Mismas
-- reglas que el objeto en storage, para que no se puedan desincronizar.
create policy attachments_delete on attachments for delete
  using (
    current_wow_role() in ('SUPERVISOR', 'ADMIN')
    or (
      entity_type = 'order'
      and exists (
        select 1 from orders o
        where o.id = attachments.entity_id
          and o.seller_id = current_wow_user_id()
          and o.status in ('DRAFT', 'RETURNED_TO_SELLER')
      )
    )
  );

-- ------------------------------------------------------------- funciones
-- doc 03 §9: registrar un comprobante es una operación de negocio, no un
-- INSERT suelto desde el navegador. Valida MIME, tamaño y que la ruta
-- corresponda al pedido (doc 05 §12); el tope de 3 lo aplica el trigger que
-- ya existe desde la Fase 1.
create or replace function register_order_receipt(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_checksum text default null
) returns attachments
language plpgsql
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_attachment attachments;
begin
  v_actor_id := current_wow_user_id();
  if v_actor_id is null then
    raise exception 'No autorizado: no hay usuario WOW asociado a esta sesión';
  end if;

  -- La RLS de `orders` es la que decide si este usuario puede ver el pedido;
  -- si no lo ve, para él no existe.
  if not exists (select 1 from orders where id = p_order_id) then
    raise exception 'Pedido % no existe o no es visible para este usuario', p_order_id;
  end if;

  -- La ruta debe ser exactamente receipts/orders/<este pedido>/<un archivo>:
  -- ni otro pedido, ni subcarpetas colgando.
  if p_storage_path is null
     or p_storage_path !~ ('^receipts/orders/' || p_order_id || '/[^/]+$') then
    raise exception 'La ruta del comprobante no corresponde al pedido %', p_order_id;
  end if;

  if p_mime_type is null or p_mime_type not in
     ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf') then
    raise exception 'Tipo de archivo no permitido: %', coalesce(p_mime_type, '(sin tipo)');
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'El comprobante debe pesar entre 1 byte y 10 MB';
  end if;

  insert into attachments (
    entity_type, entity_id, storage_path, original_filename,
    mime_type, size_bytes, checksum, uploaded_by
  ) values (
    'order', p_order_id, p_storage_path, p_original_filename,
    p_mime_type, p_size_bytes, p_checksum, v_actor_id
  ) returning * into v_attachment;

  return v_attachment;
end;
$$;

revoke execute on function register_order_receipt(uuid,text,text,text,bigint,text) from public, anon;
grant execute on function register_order_receipt(uuid,text,text,text,bigint,text) to authenticated;

-- Borra la fila y devuelve la ruta, para que quien llama pueda borrar después
-- el archivo. En ese orden a propósito: si falla el borrado del archivo queda
-- un huérfano invisible en storage, molesto pero inofensivo. Al revés
-- quedaría una fila apuntando a un archivo que ya no existe, es decir un
-- enlace roto en pantalla.
create or replace function delete_order_receipt(p_attachment_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_path text;
begin
  delete from attachments
  where id = p_attachment_id and entity_type = 'order'
  returning storage_path into v_path;

  if v_path is null then
    raise exception 'No se pudo eliminar el comprobante: no existe o no tienes permiso';
  end if;

  return v_path;
end;
$$;

revoke execute on function delete_order_receipt(uuid) from public, anon;
grant execute on function delete_order_receipt(uuid) to authenticated;
