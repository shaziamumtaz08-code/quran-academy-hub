-- Remaining 23 backfill rows
DO $a10$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='hira.na@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE lower(email)='heeraayy@gmail.com' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,email,country,guardian_type) VALUES ('Naheed Haroon','heeraayy@gmail.com','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a10$;

DO $a11$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='kainat.nu@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Nusrat','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a11$;

DO $a12$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='laiba.ma@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='923232214845' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Mahajabeen Nadeem','923232214845','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a12$;

DO $a13$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='manaal.al@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='0403566412' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Alia Soomro','0403566412','Australia','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a13$;

DO $a14$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='ammar.sa@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='923332450266' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Sabina','923332450266','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a14$;

DO $a15$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='neha.er@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='923212013553' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Erum Ashfaq','923212013553','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a15$;

DO $a16$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='nida.sh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE lower(email)='babblibani@gmail.com' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN SELECT id INTO _p FROM profiles WHERE whatsapp_number='923363215266' AND archived_at IS NULL LIMIT 1; END IF;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,email,whatsapp_number,country,guardian_type) VALUES ('Shaheen Azmat','babblibani@gmail.com','923363215266','United Arab Emirates','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a16$;

DO $a17$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='nishat.ro@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Roshan','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a17$;

DO $a18$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='nosheen.si@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Sirwer','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a18$;

DO $a19$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='rashida.hb@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Hbiba bibi','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a19$;

DO $a20$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='razia.ay@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Ayesha','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a20$;

DO $a21$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='saba.sa@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Sakina Banu','United Arab Emirates','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a21$;

DO $a22$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='sadia.as@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE lower(email)='asmaamin843@gmail.com' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN SELECT id INTO _p FROM profiles WHERE whatsapp_number='923222704450' AND archived_at IS NULL LIMIT 1; END IF;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,email,whatsapp_number,country,guardian_type) VALUES ('Asma Amin','asmaamin843@gmail.com','923222704450','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a22$;

DO $a23$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='safa.eh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='923008207321' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Ehlia Amir','923008207321','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a23$;

DO $a24$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='samina.qa@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='5103723782' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Qamar un Nisa','5103723782','United States','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a24$;

DO $a25$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='samreen.kh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Khalida','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a25$;

DO $a26$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='sanahumair.sh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='923332422279' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Shahida','923332422279','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a26$;

DO $a27$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='shafqa.sh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='03200265189' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Shahida','03200265189','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a27$;

DO $a28$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='soma.sh@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Shamim Pervez','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a28$;

DO $a29$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='tahira.fa@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Farida Raja','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a29$;

DO $a30$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='tanzeela.nu@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Nusrat Afza','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a30$;

DO $a31$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='uzma.ya@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  SELECT id INTO _p FROM profiles WHERE whatsapp_number='923213182231' AND archived_at IS NULL LIMIT 1;
  IF _p IS NULL THEN INSERT INTO profiles (full_name,whatsapp_number,country,guardian_type) VALUES ('Amina','923213182231','Pakistan','parent') RETURNING id INTO _p; END IF;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM student_parent_links WHERE student_id=_s AND parent_id=_p) THEN INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p); END IF;
END $a31$;

DO $a32$ DECLARE _s uuid; _p uuid;
BEGIN
  SELECT id INTO _s FROM profiles WHERE lower(email)='zakia.ma@alqurantimeacademy.com' AND archived_at IS NULL LIMIT 1;
  IF _s IS NULL THEN RETURN; END IF;
  INSERT INTO profiles (full_name,country,guardian_type) VALUES ('Maryam','Pakistan','parent') RETURNING id INTO _p;
  INSERT INTO user_roles (user_id,role) VALUES (_p,'parent'::app_role) ON CONFLICT (user_id,role) DO NOTHING;
  INSERT INTO student_parent_links (student_id,parent_id) VALUES (_s,_p);
END $a32$;