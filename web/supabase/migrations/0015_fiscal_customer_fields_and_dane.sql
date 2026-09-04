-- ============================================================================
-- Ficha fiscal completa del cliente (doc 11 §25/§63, formulario legado).
--
-- El modelo de datos ya traía casi todo desde la Fase 1 (DV, departamento,
-- state_code/city_code, código postal, responsabilidad fiscal, tipo de
-- compra/cliente, canal, cupo de crédito, web). Lo que faltaba de verdad es:
--   1. el catálogo DANE de departamentos/ciudades, sin el cual no se pueden
--      llenar state_code/city_code — y Siigo los exige para facturar;
--   2. el código de sucursal y la persona de contacto del salón, que el
--      formulario legado sí capturaba y aquí no existían;
--   3. una fecha de cumpleaños para el canal B2C.
-- ============================================================================

-- ------------------------------------------------------------------ DANE
-- Códigos oficiales DANE (los mismos que usaba el formulario legado). Es un
-- catálogo de referencia: lo lee cualquier usuario autenticado, y nadie lo
-- escribe desde la aplicación.
create table dane_locations (
  city_code text primary key,          -- 5 dígitos, p.ej. 11001
  city_name text not null,
  state_code text not null,            -- 2 dígitos, p.ej. 11
  department text not null
);

create index dane_locations_department_idx on dane_locations (department);

alter table dane_locations enable row level security;

create policy dane_locations_select on dane_locations for select
  using (auth.uid() is not null);

insert into dane_locations (department, state_code, city_name, city_code) values
('Amazonas','91','Leticia','91001'),('Amazonas','91','Puerto Nariño','91540'),
('Antioquia','05','Medellín','05001'),('Antioquia','05','Bello','05088'),('Antioquia','05','Itagüí','05360'),
('Antioquia','05','Envigado','05266'),('Antioquia','05','Apartadó','05045'),('Antioquia','05','Turbo','05837'),
('Antioquia','05','Rionegro','05615'),('Antioquia','05','Sabaneta','05631'),('Antioquia','05','Copacabana','05212'),
('Antioquia','05','La Estrella','05380'),('Antioquia','05','Caldas','05129'),('Antioquia','05','Barbosa','05079'),
('Antioquia','05','Girardota','05308'),('Antioquia','05','Caucasia','05154'),('Antioquia','05','Yarumal','05887'),
('Antioquia','05','Santa Fe de Antioquia','05042'),('Antioquia','05','Andes','05034'),('Antioquia','05','Jericó','05368'),
('Antioquia','05','Marinilla','05440'),
('Arauca','81','Arauca','81001'),('Arauca','81','Saravena','81736'),('Arauca','81','Tame','81794'),('Arauca','81','Arauquita','81065'),
('Atlántico','08','Barranquilla','08001'),('Atlántico','08','Soledad','08758'),('Atlántico','08','Malambo','08433'),
('Atlántico','08','Sabanalarga','08638'),('Atlántico','08','Baranoa','08078'),('Atlántico','08','Santo Tomás','08760'),
('Bogotá D.C.','11','Bogotá','11001'),
('Bolívar','13','Cartagena','13001'),('Bolívar','13','Magangué','13430'),('Bolívar','13','El Carmen de Bolívar','13244'),
('Bolívar','13','Mompox','13468'),
('Boyacá','15','Tunja','15001'),('Boyacá','15','Duitama','15238'),('Boyacá','15','Sogamoso','15759'),
('Boyacá','15','Chiquinquirá','15176'),('Boyacá','15','Paipa','15516'),
('Caldas','17','Manizales','17001'),('Caldas','17','La Dorada','17380'),('Caldas','17','Chinchiná','17174'),
('Caldas','17','Riosucio','17614'),('Caldas','17','Villamaría','17873'),
('Caquetá','18','Florencia','18001'),('Caquetá','18','San Vicente del Caguán','18753'),
('Casanare','85','Yopal','85001'),('Casanare','85','Aguazul','85010'),('Casanare','85','Villanueva','85440'),
('Casanare','85','Tauramena','85410'),
('Cauca','19','Popayán','19001'),('Cauca','19','Santander de Quilichao','19698'),('Cauca','19','Puerto Tejada','19573'),
('Cesar','20','Valledupar','20001'),('Cesar','20','Aguachica','20011'),('Cesar','20','Codazzi','20178'),
('Chocó','27','Quibdó','27001'),('Chocó','27','Istmina','27361'),
('Córdoba','23','Montería','23001'),('Córdoba','23','Lorica','23417'),('Córdoba','23','Sahagún','23660'),
('Córdoba','23','Cereté','23162'),('Córdoba','23','Montelíbano','23466'),
('Cundinamarca','25','Soacha','25754'),('Cundinamarca','25','Fusagasugá','25290'),('Cundinamarca','25','Facatativá','25269'),
('Cundinamarca','25','Zipaquirá','25899'),('Cundinamarca','25','Chía','25175'),('Cundinamarca','25','Mosquera','25473'),
('Cundinamarca','25','Madrid','25430'),('Cundinamarca','25','Funza','25286'),('Cundinamarca','25','Cajicá','25126'),
('Cundinamarca','25','Sopó','25758'),('Cundinamarca','25','La Calera','25377'),('Cundinamarca','25','Sibaté','25740'),
('Cundinamarca','25','Girardot','25307'),('Cundinamarca','25','Villeta','25875'),
('Guajira','44','Riohacha','44001'),('Guajira','44','Maicao','44430'),('Guajira','44','Uribia','44847'),('Guajira','44','Manaure','44560'),
('Guaviare','95','San José del Guaviare','95001'),
('Huila','41','Neiva','41001'),('Huila','41','Pitalito','41551'),('Huila','41','Garzón','41298'),('Huila','41','La Plata','41396'),
('Magdalena','47','Santa Marta','47001'),('Magdalena','47','Ciénaga','47189'),('Magdalena','47','Fundación','47288'),
('Meta','50','Villavicencio','50001'),('Meta','50','Acacías','50006'),('Meta','50','Granada','50313'),('Meta','50','San Martín','50689'),
('Nariño','52','Pasto','52001'),('Nariño','52','Tumaco','52835'),('Nariño','52','Ipiales','52356'),('Nariño','52','La Unión','52399'),
('Norte de Santander','54','Cúcuta','54001'),('Norte de Santander','54','Ocaña','54498'),
('Norte de Santander','54','Pamplona','54518'),('Norte de Santander','54','Villa del Rosario','54874'),
('Putumayo','86','Mocoa','86001'),('Putumayo','86','Puerto Asís','86568'),
('Quindío','63','Armenia','63001'),('Quindío','63','Calarcá','63130'),('Quindío','63','Montenegro','63470'),('Quindío','63','Quimbaya','63594'),
('Risaralda','66','Pereira','66001'),('Risaralda','66','Dosquebradas','66170'),('Risaralda','66','Santa Rosa de Cabal','66682'),
('Risaralda','66','La Virginia','66400'),
('San Andrés','88','San Andrés','88001'),('San Andrés','88','Providencia','88564'),
('Santander','68','Bucaramanga','68001'),('Santander','68','Barrancabermeja','68081'),('Santander','68','Floridablanca','68276'),
('Santander','68','Girón','68307'),('Santander','68','Piedecuesta','68547'),('Santander','68','Socorro','68755'),
('Sucre','70','Sincelejo','70001'),('Sucre','70','Corozal','70215'),('Sucre','70','Sampués','70670'),
('Tolima','73','Ibagué','73001'),('Tolima','73','Espinal','73268'),('Tolima','73','Honda','73349'),
('Tolima','73','Melgar','73449'),('Tolima','73','Líbano','73411'),
('Valle del Cauca','76','Cali','76001'),('Valle del Cauca','76','Buenaventura','76109'),('Valle del Cauca','76','Palmira','76520'),
('Valle del Cauca','76','Buga','76111'),('Valle del Cauca','76','Tuluá','76834'),('Valle del Cauca','76','Cartago','76147'),
('Valle del Cauca','76','Jamundí','76364'),('Valle del Cauca','76','Yumbo','76892'),
('Vaupés','97','Mitú','97001'),
('Vichada','99','Puerto Carreño','99001');

-- --------------------------------------------------------------- clientes
-- Datos que el formulario legado sí capturaba y que aquí no existían.
alter table customers add column branch_code text;              -- código de sucursal de la vendedora
alter table customers add column phone_indicative text;         -- indicativo (601, 604, …)
alter table customers add column contact_first_name text;       -- persona de contacto del salón
alter table customers add column contact_last_name text;
alter table customers add column contact_email text;
alter table customers add column contact_phone text;
alter table customers add column birthday date;                 -- solo se usa en B2C

comment on column customers.contact_email is
  'Correo de la persona de contacto. El correo de facturación electrónica DIAN es customers.email.';

-- --------------------------------------------------------------- pedidos
-- doc 11 §33: de dónde salió la venta. Es solo para reportes, nunca afecta
-- la factura.
alter table orders add column sale_origin text;

-- Las cotizaciones quedan como entidad propia (no como un "tipo de documento"
-- del pedido), pero necesitan el mismo % de retención que los pedidos para
-- que el total que ve el cliente sea el mismo que va a pagar.
alter table quotes add column retention_percent numeric(5,2) not null default 0;
alter table quotes add column payment_method text;
