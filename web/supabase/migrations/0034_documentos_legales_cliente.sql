-- ============================================================================
-- Documentos legales del cliente (Cámara de Comercio, RUT, cédula, etc.).
--
-- Mismo patrón que los comprobantes de pago de pedidos (0018): bucket
-- privado, ruta con el id de la entidad para que la política de storage
-- reuse las reglas que ya gobiernan esa fila, sin URL pública.
-- ============================================================================

-- `label` es de uso general en `attachments` (no solo de este bucket): un
-- texto libre y opcional para distinguir qué es cada archivo cuando una
-- misma entidad puede tener más de uno de distinto tipo — cosa que un
-- comprobante de pago no necesitaba, pero "Cámara de Comercio" vs "RUT" vs
-- "Cédula" sí.
alter table attachments add column label text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-documents', 'customer-documents', false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convención de ruta: customers/<customer_id>/<uuid>.<ext>
create or replace function public.customer_document_path_id(p_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_parts text[];
begin
  v_parts := storage.foldername(p_name);
  if array_length(v_parts, 1) is null or v_parts[1] <> 'customers' then
    return null;
  end if;
  begin
    return v_parts[2]::uuid;
  exception when others then
    return null;
  end;
end;
$$;

revoke execute on function public.customer_document_path_id(text) from public, anon;
grant execute on function public.customer_document_path_id(text) to authenticated;

-- Leer: cualquier usuario WOW activo, igual que los comprobantes de pago —
-- roster pequeño, y el documento fiscal de un cliente lo necesita ver
-- cualquiera que esté armándole o facturándole un pedido.
create policy customer_documents_select on storage.objects for select
  using (
    bucket_id = 'customer-documents'
    and public.current_wow_role() is not null
  );

-- Subir: solo bajo customers/<id>/ y solo si ese cliente es visible para
-- quien sube (la RLS de `customers` decide eso).
create policy customer_documents_insert on storage.objects for insert
  with check (
    bucket_id = 'customer-documents'
    and public.current_wow_role() is not null
    and exists (
      select 1 from public.customers c
      where c.id = public.customer_document_path_id(name)
    )
  );

-- Borrar: un documento legal no es como un comprobante recién subido que la
-- propia vendedora puede quitar si se equivocó — ya queda archivado contra
-- el cliente, así que solo supervisión/admin lo retira.
create policy customer_documents_delete on storage.objects for delete
  using (
    bucket_id = 'customer-documents'
    and public.current_wow_role() in ('SUPERVISOR', 'ADMIN')
  );

create policy attachments_delete_customer_docs on attachments for delete
  using (
    entity_type = 'customer'
    and current_wow_role() in ('SUPERVISOR', 'ADMIN')
  );

-- Tope de 5 documentos por cliente — no hay una regla del negocio que diga
-- un número exacto, pero sin tope un cliente podría acumular archivos sin
-- límite; 5 cubre Cámara de Comercio + RUT + cédula(s) + algún respaldo de
-- sobra.
create or replace function enforce_max_receipts_per_order() returns trigger as $$
begin
  if new.entity_type = 'order' and (
    select count(*) from attachments
    where entity_type = 'order' and entity_id = new.entity_id
  ) >= 3 then
    raise exception 'El pedido % ya tiene el máximo de 3 comprobantes', new.entity_id;
  elsif new.entity_type = 'customer' and (
    select count(*) from attachments
    where entity_type = 'customer' and entity_id = new.entity_id
  ) >= 5 then
    raise exception 'El cliente % ya tiene el máximo de 5 documentos', new.entity_id;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function register_customer_document(
  p_customer_id uuid,
  p_storage_path text,
  p_original_filename text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_label text default null
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

  if not exists (select 1 from customers where id = p_customer_id) then
    raise exception 'Cliente % no existe o no es visible para este usuario', p_customer_id;
  end if;

  if p_storage_path is null
     or p_storage_path !~ ('^customer-documents/customers/' || p_customer_id || '/[^/]+$') then
    raise exception 'La ruta del documento no corresponde al cliente %', p_customer_id;
  end if;

  if p_mime_type is null or p_mime_type not in
     ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf') then
    raise exception 'Tipo de archivo no permitido: %', coalesce(p_mime_type, '(sin tipo)');
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'El documento debe pesar entre 1 byte y 10 MB';
  end if;

  insert into attachments (
    entity_type, entity_id, storage_path, original_filename,
    mime_type, size_bytes, uploaded_by, label
  ) values (
    'customer', p_customer_id, p_storage_path, p_original_filename,
    p_mime_type, p_size_bytes, v_actor_id, p_label
  ) returning * into v_attachment;

  return v_attachment;
end;
$$;

revoke execute on function register_customer_document(uuid,text,text,text,bigint,text) from public, anon;
grant execute on function register_customer_document(uuid,text,text,text,bigint,text) to authenticated;

create or replace function delete_customer_document(p_attachment_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_path text;
begin
  delete from attachments
  where id = p_attachment_id and entity_type = 'customer'
  returning storage_path into v_path;

  if v_path is null then
    raise exception 'No se pudo eliminar el documento: no existe o no tienes permiso';
  end if;

  return v_path;
end;
$$;

revoke execute on function delete_customer_document(uuid) from public, anon;
grant execute on function delete_customer_document(uuid) to authenticated;
