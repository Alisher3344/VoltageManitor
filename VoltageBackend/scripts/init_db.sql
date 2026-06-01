-- Voltage uchun alohida baza va foydalanuvchi.
-- <PAROL> ni o'zingiz tanlagan kuchli parol bilan almashtiring
-- (xuddi shu parolni .env dagi DATABASE_URL ga ham yozasiz).

CREATE USER voltage_user WITH PASSWORD '<PAROL>';
CREATE DATABASE voltage OWNER voltage_user;
GRANT ALL PRIVILEGES ON DATABASE voltage TO voltage_user;
