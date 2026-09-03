insert into public.categories(id,name,slug) values
('10000000-0000-0000-0000-000000000001','Complete Gearboxes','complete-gearboxes'),
('10000000-0000-0000-0000-000000000002','Mechatronic Units','mechatronic-units'),
('10000000-0000-0000-0000-000000000003','Clutch Assemblies','clutch-assemblies'),
('10000000-0000-0000-0000-000000000004','Valve Bodies','valve-bodies'),
('10000000-0000-0000-0000-000000000005','Repair Kits','repair-kits'),
('10000000-0000-0000-0000-000000000006','Oil Pumps','oil-pumps') on conflict do nothing;
insert into public.sellers(id,owner_id,business_name,slug,location,postcode,description,verified_at) values
('20000000-0000-0000-0000-000000000001',null,'Northline Transmissions','northline-transmissions','Leeds','LS10','Automatic transmission specialist supplying tested and reconditioned DSG parts across the UK.',now()),
('20000000-0000-0000-0000-000000000002',null,'Gearbox Lab UK','gearbox-lab-uk','Birmingham','B11','Independent gearbox workshop focused on mechatronics, control units and wet clutch systems.',now()),
('20000000-0000-0000-0000-000000000003',null,'West Coast Auto Salvage','west-coast-auto-salvage','Glasgow','G51','Quality checked used transmission components with clear donor and compatibility records.',now()) on conflict do nothing;
insert into public.vehicles(id,make,model,generation,year,engine,engine_code,gearbox_family,gearbox_code) values
('30000000-0000-0000-0000-000000000001','Volkswagen','Golf','Mk7',2017,'2.0 TDI','CRBC','DQ250','02E'),
('30000000-0000-0000-0000-000000000002','Audi','A3','8V',2018,'2.0 TDI','CRLB','DQ250','02E'),
('30000000-0000-0000-0000-000000000003','Škoda','Octavia','5E',2017,'2.0 TDI','CRMB','DQ250','02E'),
('30000000-0000-0000-0000-000000000004','Volkswagen','Polo','6R',2015,'1.2 TSI','CJZC','DQ200','0AM'),
('30000000-0000-0000-0000-000000000005','SEAT','Ibiza','6J',2015,'1.2 TSI','CJZC','DQ200','0AM'),
('30000000-0000-0000-0000-000000000006','Audi','A4','B9',2019,'2.0 TFSI','CYRB','DL382','0CK'),
('30000000-0000-0000-0000-000000000007','Volkswagen','Transporter','T5',2015,'2.0 TDI','CFCA','DQ500','0BT'),
('30000000-0000-0000-0000-000000000008','Audi','Q3','8U',2016,'2.0 TDI','CUVC','DQ500','0BH') on conflict do nothing;
insert into public.parts(id,seller_id,category_id,title,slug,description,manufacturer,part_number,oem_number,gearbox_family,gearbox_code,condition,price_pence,stock,status,dispatch_days) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','DQ250 Complete Gearbox 02E','dq250-complete-gearbox-02e','Fully reconditioned six-speed wet-clutch DSG gearbox, bench tested and supplied with warranty.','Volkswagen Group','SP-DQ250-001','02E 300 062','DQ250','02E','reconditioned',124900,2,'active',1),
('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','DQ200 Mechatronic Unit 0AM','dq200-mechatronic-unit-0am','Reconditioned seven-speed dry-clutch DSG mechatronic unit supplied programmed to the correct application.','Volkswagen Group','SP-DQ200-014','0AM 325 065','DQ200','0AM / 0CW','reconditioned',68900,4,'active',1),
('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','DL382 Wet Clutch Assembly','dl382-wet-clutch-assembly','New wet clutch assembly for longitudinal seven-speed S tronic DL382 applications.','LuK','SP-DL382-006','0CK 141 030','DL382','0CK / 0CL','new',54500,6,'active',0),
('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','DQ500 Valve Body Assembly','dq500-valve-body-assembly','Used genuine DQ500 valve body, cleaned, pressure checked and supplied with donor details.','Volkswagen Group','SP-DQ500-022','0BH 325 039','DQ500','0BH / 0BT','used',42900,1,'active',2),
('40000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','DSG Solenoid Repair Set','dsg-solenoid-repair-set','New replacement solenoid set for selected DQ200 and DQ250 mechatronic repair applications.','Aftermarket','SP-DSG-SOL-01',null,'DQ200 / DQ250','0AM / 02E','new',18900,12,'active',0)
on conflict do nothing;
insert into public.part_fitments(part_id,vehicle_id,notes) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Confirm final drive ratio before ordering.'),
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Confirm gearbox code 02E.'),
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','Confirm gearbox code 02E.'),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004','Programming required after installation.'),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005','Programming required after installation.'),
('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000006','Verify clutch generation by VIN before fitting.'),
('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000007','Confirm 0BT application.'),
('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000008','Confirm 0BH application.') on conflict do nothing;
