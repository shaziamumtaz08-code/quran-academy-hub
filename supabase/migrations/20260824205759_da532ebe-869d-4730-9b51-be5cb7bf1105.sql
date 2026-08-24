DO $$
DECLARE
  _id uuid;
  _secret uuid;
  rows_data text[][] := ARRAY[
    ARRAY['AQTA Zoom — Nazia Shahid','nazia.aqt@gmail.com','Nazia1234','9465871049','abcd1','695248','free','dedicated','active'],
    ARRAY['AQTA Pool 01','alqurantimepk@gmail.com','Alqurantime&145','84048269119',NULL,'677186','free','shared','active'],
    ARRAY['AQTA Pool 02','alqurantime.123@gmail.com','Alquran123@6','88319968468',NULL,'032110','free','shared','active'],
    ARRAY['AQTA Pool 03','alqurantimeinstitute@gmail.com','Aqtimeinstitute#303','86317503591',NULL,'597683','free','shared','active'],
    ARRAY['AQTA Pool 04','alqurantimeonline@gmail.com','Aqtimeonline@406','85070466356',NULL,'149389','free','shared','active'],
    ARRAY['AQTA Pool 05','alqurantimeoffical@gmail.com','Aqtime@409','81157545455',NULL,'151389','free','shared','active'],
    ARRAY['AQTA Pool 06','aqtimelearning@gmail.com','Quran@Time_88','82857122571',NULL,NULL,'free','shared','active'],
    ARRAY['AQTA Pool 07','alquran.time2.1@gmail.com','AlQ@Time!2025','9967976788',NULL,'930742','free','shared','active'],
    ARRAY['AQTA Pool 08','alquran.ti.me1.1@gmail.com','AQT!Admin$5','8038280244',NULL,'051128','free','shared','active'],
    ARRAY['AQTA Pool 09','alqurantime1.0@gmail.com','AlQuran#Time9','7822669828',NULL,'353597','free','shared','active'],
    ARRAY['AQTA Pool 10','alquran.time77@gmail.com','Allahis@1',NULL,NULL,'125128','free','shared','active'],
    ARRAY['AQTA Pool 11','alqurantimeacademy687@gmail.com','Allumdullah',NULL,NULL,'786786','free','shared','active'],
    ARRAY['AQTA Pool 12 (trial)','ajfkaleme+anum05@gmail.com','R75WYuj9p3',NULL,NULL,'125125','free','shared','disabled'],
    ARRAY['AQTA Exam 1','alqurantimeexam1@gmail.com','examid#1','4358704853','2345',NULL,'free','shared','active'],
    ARRAY['AQTA Exam 2','alqurantimeexam2@gmail.com','examid#2','8403384839','11111',NULL,'free','shared','active'],
    ARRAY['AQTA Exam 3','alqurantimeexam3@gmail.com','examid#3','4792066530','1212','786786','free','shared','active'],
    ARRAY['AQTA Zoom Main','alqurantime786@gmail.com','Alhamdulillah1984','3583193702','777',NULL,'free','shared','active'],
    ARRAY['AQTA Zoom Pro — madysonwill','madysonwill@ves.ink','Maki123!',NULL,NULL,NULL,'paid','shared','disabled'],
    ARRAY['AQTA Zoom Pro — klararara','klararara@suivy.shop','Shincore123',NULL,NULL,'786786','paid','shared','disabled'],
    ARRAY['AQTA Zoom Premium — rosehaley','rosehaley@ves.ink','Maki123!',NULL,NULL,'786786','paid','shared','disabled'],
    ARRAY['AQTA Zoom — Qari (qariaqt)','qariaqt@gmail.com','Allahis1&only',NULL,'0000',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Malia Nishat','bintenishatahmed@gmail.com','Alqurantime3','7569716551','7777',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Saba','alqurantime125@gmail.com','Allahis1&only','7456328775','1212',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Shazia (alt 1)','alqurantime3@gmail.com','Alhamdulillah','8403384839','11111',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Shazia Mumtaz','shazia.mumtaz08@gmail.com','Alhamdulillah','7213384106','77777','125125','free','dedicated','active'],
    ARRAY['AQTA Zoom — Shazia (alt 2)','alqurantime111@gmail.com','Shazia @g125','4792066530','1212',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Rubina Shafi','rubinashafi51@gmail.com','Allahis@','6442509004','5678','786786','free','dedicated','active'],
    ARRAY['AQTA Zoom — Sana (mullima13)','alqurantimemullima13@gmail.com','mualimasana123','4059835882','12345','377778','free','dedicated','active'],
    ARRAY['AQTA Zoom — Zainab','alqurantimeacademy14@gmail.com','Allahis&one','6199862130','3333','543451','free','dedicated','active'],
    ARRAY['AQTA Zoom — Abdullah','alqurantimea@gmail.com','Abdullah12345','7451690934','12345','276298','free','dedicated','active'],
    ARRAY['AQTA Zoom — Nazia Nishat','alqurantimeacademymullima2@gmail.com','nazia123','9425131462','121212','786786','free','dedicated','active'],
    ARRAY['AQTA Zoom — Nazia (mullima21)','alqurantimeacademymullima21@gmail.com','Nazia1234',NULL,NULL,NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Shehnaz','alqurantimemullima14@gmail.com','mualimashehnaz123','7745545646','9999','161931','free','dedicated','active'],
    ARRAY['AQTA Zoom — Romaisa','alqurantimemullima15@gmail.com','Romaisa123','5649121751','6666','669218','free','dedicated','active'],
    ARRAY['AQTA Zoom — Fatima','alqurantimemullima16@gmail.com','fatima@123','4488323570','6666',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Qari Huzaifa','alqurantimemullim17@gmail.com','Qari Huzaifa123','87482255475','5555','934666','free','dedicated','active'],
    ARRAY['AQTA Zoom — Qari Hani','alqurantimemullim18@gmail.com','Qari Hani123','6619662884','1111','383375','free','dedicated','active'],
    ARRAY['AQTA Zoom — Qari Illyas','alqurantimemullim19@gmail.com','Qari illyas123','84331414199','9999',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Quratalain (mullima20)','alqurantimemullima20@gmail.com','Quratalain123','89721619454','11111',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Amna Ghafoor','academyalqurantimemullima9@gmail.com','Amna Ghafoor 123','88059564816','786786',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Abida Hameed (mullima10)','academyalqurantimemullima10@gmail.com','Abida Hameed 123z','81092807799','125125',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Saima Rehan','academyalqurantimemullima11@gmail.com','Saima Rihana123','83953259696','111111',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Saba Abdul Razak','academyalqurantimemullima12@gmail.com','Saba Abdul Razak123','84669950385','666666','125125','free','dedicated','active'],
    ARRAY['AQTA Zoom — Najma Shafi','academyalqurantimemullima13@gmail.com','Najma Shafi123','83292998223','333333','003324','free','dedicated','active'],
    ARRAY['AQTA Zoom — Quratalain (mullima14)','academyalqurantimemullima14@gmail.com','Quratalain1234','86909310274','555555',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Rumaisa (mullima15)','academyalqurantimemullima15@gmail.com','Rumaisa123','89701431773','126126',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Shuaa','mullimashuaa@gmail.com','Shuaa0123','84341953931','123123',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Qari Ataur Rahman','alqurantimeacademymullim22@gmail.com','AtaurRahman123','85177273717','52Hhkd',NULL,'free','dedicated','active'],
    ARRAY['AQTA Zoom — Sana (ms)','alqurantimeacademyms@gmail.com','mualimasana123','82850379618','12345','183328','free','dedicated','active'],
    ARRAY['AQTA Zoom — Saniya (mualima)','alqurantimesaniya@gmail.com','mualimasaniya123','85292472449','5555','801585','free','dedicated','active'],
    ARRAY['AQTA Zoom — Kulsoom','alqurantimeacademymk@gmail.com','mualimakulsoom123','85884702664','3333','051342','free','dedicated','active'],
    ARRAY['AQTA Zoom — Kainat','alqurantimeacademykt@gmail.com','mualimakainat123','86848008946','3333','935737','free','dedicated','active']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(rows_data, 1) LOOP
    _id := NULL;
    SELECT id INTO _id FROM public.zoom_vault_accounts
      WHERE lower(zoom_email) = lower(rows_data[i][2]) LIMIT 1;
    IF _id IS NOT NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.zoom_vault_accounts
      (label, zoom_email, pmi, passcode, host_key, account_type, pool_assignment, status)
    VALUES (
      rows_data[i][1], lower(rows_data[i][2]), rows_data[i][4], rows_data[i][5], rows_data[i][6],
      rows_data[i][7]::public.zoom_vault_account_type,
      rows_data[i][8]::public.zoom_pool_assignment,
      rows_data[i][9]::public.zoom_vault_status
    )
    RETURNING id INTO _id;

    IF rows_data[i][3] IS NOT NULL THEN
      _secret := vault.create_secret(
        rows_data[i][3],
        'zoom_vault_' || _id::text || '_zoom_password',
        'Zoom vault credential'
      );
      UPDATE public.zoom_vault_accounts SET zoom_password_secret_id = _secret WHERE id = _id;
    END IF;
  END LOOP;
END $$;