-- 69 : Langue de l'interface par defaut = anglais pour les NOUVEAUX comptes
-- (l'inscription enregistre desormais la langue choisie sur le lien : ?lang=en|fr|ar).
alter table clients alter column langue_preferee set default 'en';

-- Pour passer UN compte existant en anglais (a adapter), par exemple ton compte de test :
-- update clients set langue_preferee = 'en' where email = 'test3@gmail.com';
