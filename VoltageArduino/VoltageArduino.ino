// ESP32-C3 Super Mini + SIM800L V2 EVB
// Arduino IDE: Tools > Board > ESP32C3 Dev Module
//              Tools > USB CDC On Boot > Enabled   (Serial Monitor uchun MUHIM)
//
// Ulanish (SIM800L V2 EVB):
//   V2 VDD   -> ESP32 3V3        (UART logikasi 3.3V)
//   V2 TXD   -> ESP32 GPIO 20 (RX)
//   V2 RXD   -> ESP32 GPIO 21 (TX)
//   V2 GND   -> ESP32 GND        (umumiy)
//   V2 5VIN  -> ALOHIDA 5V 2A manba
//
//   3.3V signal manbai -> ESP32 GPIO 3  (umumiy GND bilan)
//
// ====================================================================
//  QURILMA ID — bir marta kiritiladi, fleshда saqlanadi (NVS).
//  Bir xil proshivkani hamma qurilmaga yozasiz, ID'ni esa har biriga
//  Serial Monitor orqali alohida kiritasiz. Saytdagi ID bilan BIR XIL
//  bo'lishi shart — sayt qurilmani shu ID bo'yicha ajratadi.
//
//  Serial Monitor (115200) ga yozib o'rnatish:
//      id 11        yoki      id=11
//  Joriy ID'ni ko'rish:
//      id?
// ====================================================================

#include <HardwareSerial.h>
#include <Preferences.h>

HardwareSerial sim800(1);   // UART1
Preferences   prefs;

// ============ SOZLAMALAR ============
const int SIM_RX_PIN = 20;  // ESP32 RX <- SIM800L TX
const int SIM_TX_PIN = 21;  // ESP32 TX -> SIM800L RX
const int SIGNAL_PIN = 3;   // 3.3V signal (HIGH=1 yoniq, LOW=0 o'chiq)

// ======== QURILMA ID ========
// Eng oddiy yo'l: shu yerga yozing (saytdagi ID bilan BIR XIL bo'lsin).
// Yoki bo'sh "" qoldirib, Serial Monitor'da "id 11" deb kiriting (fleshда saqlanadi).
const char* DEFAULT_DEVICE_ID = "11";
// =============================

const char* APN = "internet";

// Backend TCP listener (port 5001) ochiq turgan manzil — STANDART qiymatlar.
// ssmart serveri (voltage-api konteyneri 0.0.0.0:5001 host'ga chiqarilgan).
// Manzil o'zgarsa, qurilmaga SMS yuborib (masalan "1.2.3.4:5001") host/port'ni
// masofadan yangilash mumkin (NVS'ga saqlanadi).
// Agar 5001 firewall'da bloklangan bo'lsa — Pinggy tunnel orqali oching:
//   ssh -p 443 -R0:localhost:5001 tcp@a.pinggy.io
// Server NAT/CGNAT ortida — to'g'ridan-to'g'ri IP'ga kirib bo'lmaydi.
// Shuning uchun bore.pub tunnel orqali ulanamiz (bepul, doimiy manzil, o'zgarmaydi).
// Serverda cron tunnelni doim tirik tutadi: bore.pub:45001 -> localhost:5001
const char* DEFAULT_HOST = "bore.pub";        // doimiy tunnel manzili
const int   DEFAULT_PORT = 45001;             // bore.pub porti -> server 5001

// Ixtiyoriy ingest tokeni — backend .env dagi INGEST_TOKEN bilan BIR XIL bo'lsin.
// Bo'sh "" qoldirilsa, eski "id:value" formati yuboriladi.
const char* INGEST_TOKEN = "7674e77e034dc6b2";
// ====================================

String        deviceId  = "";    // NVS'dan yuklanadi
String        serverHost = "";    // NVS'dan; bo'sh bo'lsa DEFAULT_HOST
int           serverPort = 0;     // NVS'dan; 0 bo'lsa DEFAULT_PORT
int           lastValue = -1;
bool          tcpOpen    = false;
unsigned long lastSendMs = 0;
String        cliBuf     = "";    // Serial buyruq buferi
String        simIccid   = "";    // SIM seriya raqami (o'zgarmas)
String        simPhone   = "";    // SIM telefon raqami (ko'pincha bo'sh)
bool          metaSent   = false; // META har ulanishda bir marta yuboriladi
bool          resyncNeeded = false; // qayta ulangach joriy holatni majburan yuborish

// -------- Sozlamalarni saqlash (NVS / Preferences) --------
void loadId() {
  prefs.begin("voltage", true);                        // read-only
  deviceId   = prefs.getString("id", DEFAULT_DEVICE_ID);
  serverHost = prefs.getString("host", DEFAULT_HOST);  // SMS bilan o'zgartirilgan bo'lsa o'sha
  serverPort = prefs.getInt("port", DEFAULT_PORT);
  prefs.end();
}

void saveId(const String& id) {
  prefs.begin("voltage", false);
  prefs.putString("id", id);
  prefs.end();
  deviceId = id;
  Serial.print("ID saqlandi: ");
  Serial.println(deviceId);
}

// Yangi server manzilini saqlash (SMS yoki Serial orqali)
void saveAddress(const String& host, int port) {
  serverHost = host;
  serverPort = port;
  prefs.begin("voltage", false);
  prefs.putString("host", host);
  prefs.putInt("port", port);
  prefs.end();
  tcpOpen = false;     // qayta ulanishga majbur qilamiz
  metaSent = false;
  Serial.printf("Yangi manzil saqlandi: %s:%d\n", host.c_str(), port);
}

// "host:port" matnidan manzilni ajratib qo'llaydi (SMS/Serial uchun).
// "SET 1.2.3.4:5678" kabi old qo'shimchaga ham bardosh.
bool applyAddress(String text) {
  text.trim();
  int colon = text.lastIndexOf(':');
  if (colon < 1) return false;
  String host = text.substring(0, colon);
  String portStr = text.substring(colon + 1);
  host.trim();
  // hostdan oldingi keraksiz so'zlarni (masalan "SET ") olib tashlash
  int sp = host.lastIndexOf(' ');
  if (sp >= 0) host = host.substring(sp + 1);
  // portdagi raqamlarni olish
  int port = portStr.toInt();
  if (host.length() < 3 || port <= 0 || port > 65535) return false;
  saveAddress(host, port);
  return true;
}

// Serial Monitor'dan "id 11" / "id=11" / "id?" buyruqlarini o'qiydi
void pollSerialConfig() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      cliBuf.trim();
      if (cliBuf.length()) {
        if (cliBuf == "id?") {
          Serial.print("Joriy ID: ");
          Serial.println(deviceId.length() ? deviceId : "(o'rnatilmagan)");
          Serial.printf("Server: %s:%d\n", serverHost.c_str(), serverPort);
        } else if (cliBuf.startsWith("addr")) {
          // "addr 1.2.3.4:5678" — server manzilini qo'lda o'rnatish
          String v = cliBuf.substring(4);
          v.replace("=", " ");
          if (!applyAddress(v)) Serial.println("Foydalanish: addr 1.2.3.4:5678");
        } else if (cliBuf.startsWith("id")) {
          String v = cliBuf.substring(2);
          v.replace("=", " ");
          v.trim();
          if (v.length()) saveId(v);
          else Serial.println("Foydalanish: id 11");
        }
      }
      cliBuf = "";
    } else if (cliBuf.length() < 40) {
      cliBuf += c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  sim800.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  pinMode(SIGNAL_PIN, INPUT_PULLDOWN);   // signal yo'qida 0, 3.3V kelsa 1

  delay(3000);
  Serial.println("\n=== Voltage qurilma ===");
  loadId();
  if (deviceId.length())
    Serial.printf("Qurilma ID: %s\n", deviceId.c_str());
  else
    Serial.println("DIQQAT: ID o'rnatilmagan! Serial'ga 'id 11' deb yozing.");
  Serial.printf("Server manzili: %s:%d\n", serverHost.c_str(), serverPort);
  Serial.println("(o'zgartirish: SMS yoki Serial 'addr 1.2.3.4:5678')");

  if (initModem()) {
    openTcp();
  } else {
    Serial.println("!! Modem tayyor emas - loop'да qayta urinib ko'riladi");
  }
}

void loop() {
  pollSerialConfig();   // ID kiritish/o'zgartirish istalgan vaqtda

  // CLOSED URC'sini sezish
  static String urc = "";
  while (sim800.available()) {
    char c = sim800.read();
    urc += c;
    if (c == '\n') {
      if (urc.indexOf("CLOSED") >= 0) { tcpOpen = false; metaSent = false; }
      urc = "";
    }
    if (urc.length() > 64) urc = "";
  }

  // ID o'rnatilmaган bo'lsa — yubormaymiz
  if (!deviceId.length()) {
    delay(200);
    return;
  }

  // Ulanish uzilgan bo'lsa — har 20s modemni qayta tekshirib ulaymiz.
  // Bundan oldin SMS'ni tekshiramiz: host/port noto'g'ri bo'lsa, SMS orqali
  // yangi manzil kelган bo'lishi mumkin ("172.235.166.211:41663").
  static unsigned long lastReinit = 0;
  if (!tcpOpen && millis() - lastReinit > 20000) {
    lastReinit = millis();
    Serial.println("Qayta ulanish...");
    if (initModem()) {
      checkSms();        // SMS orqali yangi host:port kelgan bo'lsa qo'llaydi
      if (!openTcp()) {
        Serial.println("  TCP ulanmadi — SMS kutilmoqda (host:port yuboring)");
      }
    }
  }

  // Ulangach SIM ma'lumotlarini (META) bir marta yuboramiz
  if (tcpOpen && !metaSent) {
    if (sendMeta()) metaSent = true;
  }

  // Tashqi signal: 3.3V -> HIGH -> 1, 0V -> LOW -> 0  (HAR doim joriy holat o'qiladi)
  int value = digitalRead(SIGNAL_PIN);

  // 1) Holat o'zgarsa — darhol yuborishga urinamiz (kerak bo'lsa qayta ulanadi)
  if (value != lastValue) {
    Serial.printf("Holat: %d\n", value);
    if (sendToServer(value)) {
      lastValue = value;
      resyncNeeded = false;
    }
  }
  // 2) Qayta ulangandan keyin — o'zgarish bo'lmasa ham joriy holatni MAJBURAN
  //    yuboramiz (uzilish vaqtidagi o'zgarishni server o'tkazib yuborган bo'lishi mumkin)
  else if (tcpOpen && resyncNeeded) {
    if (sendToServer(value)) {
      lastValue = value;
      resyncNeeded = false;
    }
  }

  // 3) Keepalive — har 10s JORIY pin holatini qayta yuboramiz (keshlangan emas).
  //    Bu ulanishni ISSIQ tutadi (GPRS/CGNAT bo'sh ulanishni uzmasin) — shunda
  //    holat o'zgarganda darhol yetib boradi. Eng yomon holatda kechikish ≤10s.
  if (tcpOpen && millis() - lastSendMs > 10000) {
    if (sendToServer(value)) lastValue = value;
  }

  delay(20);
}

bool openTcp() {
  String cmd = "AT+CIPSTART=\"TCP\",\"" + serverHost + "\"," + String(serverPort);
  Serial.print("  >> "); Serial.println(cmd);
  // "CONNECT" (OK/FAIL/ALREADY) javobi kelishi bilan erta chiqamiz — 10s kutmaymiz
  String resp = sendATUntil(cmd.c_str(), "CONNECT", 10000);
  Serial.print("  << "); Serial.println(resp);

  if (resp.indexOf("CONNECT OK") >= 0 || resp.indexOf("ALREADY CONNECT") >= 0) {
    tcpOpen = true;
    resyncNeeded = true;   // qayta ulandik — joriy holatni majburan qayta yuboramiz
    return true;
  }
  sendAT("AT+CIPSHUT", 1000);
  sendAT("AT+CIPMUX=0", 300);
  String apnCmd = "AT+CSTT=\"" + String(APN) + "\"";
  sendAT(apnCmd.c_str(), 500);
  sendAT("AT+CIICR", 3000);
  tcpOpen = false;
  return false;
}

// Token prefiksi (yoqilgan bo'lsa)
String tokenPrefix() {
  return (strlen(INGEST_TOKEN) > 0) ? (String(INGEST_TOKEN) + ":") : "";
}

// Bitta qatorni TCP orqali yuboradi (CIPSEND). Uzilsa qayta ulanib urinadi.
bool tcpSendLine(const String& line) {
  if (!tcpOpen && !openTcp()) {
    Serial.println("  X (ulanmadi)");
    return false;
  }
  String sendCmd = "AT+CIPSEND=" + String(line.length());
  // ">" prompti kelishi bilan erta chiqamiz (800ms emas, ~100ms)
  String r = sendATUntil(sendCmd.c_str(), ">", 2000);
  if (r.indexOf(">") < 0) {
    tcpOpen = false;
    metaSent = false;
    if (openTcp()) return tcpSendLine(line);
    return false;
  }
  sim800.print(line);
  // "SEND OK" ni kutamiz (erta chiqish): yetkazilganini tasdiqlaymiz va o'lik
  // ulanishni DARHOL sezamiz — keyingi keepalive'ni (10s) kutmaymiz.
  String sr = readUntil("SEND OK", 5000);
  if (sr.indexOf("SEND OK") < 0) {
    // Yetkazilmadi (ulanish o'lgan) — belgilab qo'yamiz. lastValue yangilanmagani uchun
    // keyingi sikl iteratsiyasi (~20ms) qayta ulanib darhol qayta yuboradi (rekursiyasiz).
    tcpOpen = false;
    metaSent = false;
    return false;
  }
  Serial.print("  OK -> "); Serial.print(line);
  return true;
}

bool sendToServer(int value) {
  // Format: "ID:value\n" (token yoqilgan bo'lsa "TOKEN:ID:value\n")
  String msg = tokenPrefix() + deviceId + ":" + String(value) + "\n";
  if (!tcpSendLine(msg)) return false;
  lastSendMs = millis();
  return true;
}

// SIM ma'lumotlari: "META:ID:ICCID:PHONE\n" (telefon bo'sh bo'lishi mumkin)
bool sendMeta() {
  if (!deviceId.length()) return false;
  String msg = tokenPrefix() + "META:" + deviceId + ":" + simIccid + ":" + simPhone + "\n";
  return tcpSendLine(msg);
}

void sendAT(const char* cmd, int waitMs) {
  sim800.println(cmd);
  unsigned long start = millis();
  while (millis() - start < waitMs) {
    while (sim800.available()) sim800.read();
  }
}

String sendATGetResp(const char* cmd, int waitMs) {
  sim800.println(cmd);
  String resp = "";
  unsigned long start = millis();
  while (millis() - start < waitMs) {
    while (sim800.available()) resp += (char)sim800.read();
  }
  return resp;
}

// Faqat o'qiydi (buyruq yubormaydi), kutilgan token kelishi bilan ERTA qaytadi.
String readUntil(const char* until, int waitMs) {
  String resp = "";
  unsigned long start = millis();
  while (millis() - start < waitMs) {
    while (sim800.available()) resp += (char)sim800.read();
    if (resp.indexOf(until) >= 0) break;   // tezlik: kutilgan javob kelsa darhol chiqamiz
    delay(1);
  }
  return resp;
}

// Buyruq yuboradi va kutilgan token kelishi bilan ERTA qaytadi (to'liq timeout'ni kutmaydi).
String sendATUntil(const char* cmd, const char* until, int waitMs) {
  sim800.println(cmd);
  return readUntil(until, waitMs);
}

void showResp(const char* cmd, int waitMs) {
  Serial.print(">> "); Serial.println(cmd);
  sim800.println(cmd);
  unsigned long start = millis();
  while (millis() - start < waitMs) {
    while (sim800.available()) Serial.write(sim800.read());
  }
  Serial.println();
}

// ================= AT TEKSHIRUV =================

// Buyruq yuboradi va javobда kutilgan token bor-yo'qligini tekshiradi
bool atExpect(const char* cmd, const char* token, int waitMs) {
  String r = sendATGetResp(cmd, waitMs);
  r.trim();
  bool ok = r.indexOf(token) >= 0;
  Serial.printf("   %-22s -> %s\n", cmd, ok ? "OK" : "XATO");
  if (!ok) {
    Serial.print("      javob: ");
    Serial.println(r.length() ? r : "(javob yo'q)");
  }
  return ok;
}

// Signal sifati (CSQ): 0..31 yaxshi, 99 = signal yo'q
int readCsq() {
  String r = sendATGetResp("AT+CSQ", 1000);
  int i = r.indexOf("+CSQ:");
  if (i < 0) return 99;
  return r.substring(i + 5).toInt();
}

// Tarmoqqa ro'yxatdan o'tishini kutadi (CREG: x,1 uy yoki x,5 rouming)
bool waitNetwork(int timeoutMs) {
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    String r = sendATGetResp("AT+CREG?", 1000);
    if (r.indexOf(",1") >= 0 || r.indexOf(",5") >= 0) return true;
    Serial.print(".");
    delay(1500);
  }
  Serial.println();
  return false;
}

// Matndan faqat raqamlarni oladi (ICCID uchun)
String onlyDigits(const String& s) {
  String out = "";
  for (size_t k = 0; k < s.length(); k++) {
    char c = s[k];
    if (c >= '0' && c <= '9') out += c;
  }
  return out;
}

// AT+CNUM javobidan telefon raqamini ajratadi: +CNUM: "","+99890...",129
String parseCnum(const String& r) {
  int i = r.indexOf("+CNUM:");
  if (i < 0) return "";
  int sep = r.indexOf("\",\"", i);   // ism va raqam orasidagi ","
  if (sep < 0) return "";
  int start = sep + 3;
  int end = r.indexOf("\"", start);
  if (end < 0) return "";
  return r.substring(start, end);
}

// SIM ma'lumotlarini o'qiydi (ICCID — seriya, CNUM — telefon, ko'pincha bo'sh)
void readSimInfo() {
  simIccid = onlyDigits(sendATGetResp("AT+CCID", 1500));
  simPhone = parseCnum(sendATGetResp("AT+CNUM", 1500));
  Serial.print("   SIM ICCID: ");
  Serial.println(simIccid.length() ? simIccid : "(yo'q)");
  Serial.print("   SIM telefon: ");
  Serial.println(simPhone.length() ? simPhone : "(yo'q / operator yozmagan)");
}

// Kelgan SMS'larni o'qiydi: "host:port" topilsa qo'llaydi, so'ng SMS'larni o'chiradi.
// TCP ulanmaganda chaqiriladi — tunnel manzili o'zgarsa SMS bilan tuzatish uchun.
void checkSms() {
  sendAT("AT+CMGF=1", 400);                       // matn rejimi
  String r = sendATGetResp("AT+CMGL=\"REC UNREAD\"", 5000);
  if (r.indexOf("+CMGL:") < 0) return;            // yangi SMS yo'q
  int pos = 0;
  bool applied = false;
  while (true) {
    int idx = r.indexOf("+CMGL:", pos);
    if (idx < 0) break;
    int nl = r.indexOf('\n', idx);                // sarlavha satri oxiri
    if (nl < 0) break;
    int nl2 = r.indexOf('\n', nl + 1);            // SMS tanasi oxiri
    String body = (nl2 > 0) ? r.substring(nl + 1, nl2) : r.substring(nl + 1);
    body.trim();
    if (body.length() && applyAddress(body)) applied = true;
    pos = (nl2 > 0) ? nl2 : r.length();
  }
  sendAT("AT+CMGDA=\"DEL ALL\"", 2000);           // xotira to'lib qolmasin
  if (applied) Serial.println("  SMS orqali server manzili yangilandi");
}

// Modemni bosqichma-bosqich tekshirib ishga tushiradi
bool initModem() {
  Serial.println("--- Modem tekshiruvi ---");

  // 1) Modem javob berguncha kutamiz — sovuq yoqilishda SIM800L sekin uyg'onadi
  //    (boot URC'lari: RDY, +CFUN, +CPIN, Call Ready...). Bufferni tozalab,
  //    AT ni bir necha marta yuboramiz (autobaud + boot uchun ~16s gacha).
  bool atOk = false;
  for (int i = 0; i < 16; i++) {
    while (sim800.available()) sim800.read();   // boot/URC chiqindilarini tozalash
    if (atExpect("AT", "OK", 1000)) { atOk = true; break; }
    delay(800);
  }
  if (!atOk) {
    Serial.println("XATO: modem javob bermayapti (TXD/RXD yoki 5V/2A quvvat?)");
    return false;
  }
  sendAT("ATE0", 300);   // echo off — javoblar toza bo'lsin

  // 2) SIM tayyor (PIN READY) — yoqilгandan keyin bir necha soniya kutishi mumkin
  bool pinReady = false;
  for (int i = 0; i < 12; i++) {
    if (atExpect("AT+CPIN?", "READY", 1000)) { pinReady = true; break; }
    delay(1000);
  }
  if (!pinReady) {
    Serial.println("XATO: SIM yo'q / PIN kerak / noto'g'ri o'rnatilgan");
    return false;
  }

  // 3) Eski/osilgan GPRS kontekstini tozalaymiz — qayta ulanish ishonchli bo'lsin
  sendAT("AT+CIPSHUT", 2000);

  readSimInfo();   // ICCID + telefon (SIM tayyor bo'lgach)

  // SMS: matn rejimi + avtomatik push o'chiq (biz CMGL bilan so'rab olamiz)
  sendAT("AT+CMGF=1", 400);
  sendAT("AT+CNMI=0,0,0,0,0", 400);

  int csq = readCsq();
  Serial.printf("   Signal (CSQ): %d  %s\n", csq,
                (csq == 99 || csq == 0) ? "<- SIGNAL YO'Q (antennani tekshiring!)"
                : (csq < 10) ? "(kuchsiz)" : "(yaxshi)");

  Serial.print("   Tarmoqqa ulanish");
  if (!waitNetwork(60000)) {   // sovuq yoqilishda ro'yxatdan o'tish uzoqroq bo'lishi mumkin
    Serial.println("XATO: tarmoqqa ro'yxatdan o'tmadi (signal/SIM/tarif?)");
    return false;
  }
  Serial.println("   Tarmoq: OK");

  if (!atExpect("AT+CGATT?", "+CGATT: 1", 5000)) {
    Serial.println("XATO: GPRS ulanmagan (APN yoki internet tarifi?)");
    return false;
  }

  // GPRS kontekstini ko'tarish
  sendAT("AT+CIPSHUT", 2000);
  sendAT("AT+CIPMUX=0", 500);
  String apnCmd = "AT+CSTT=\"" + String(APN) + "\"";
  if (!atExpect(apnCmd.c_str(), "OK", 2000)) {
    Serial.println("XATO: APN o'rnatilmadi");
    return false;
  }
  if (!atExpect("AT+CIICR", "OK", 10000)) {
    Serial.println("XATO: GPRS ko'tarilmadi (APN noto'g'ri yoki internet yo'q)");
    return false;
  }

  String ip = sendATGetResp("AT+CIFSR", 2000);
  ip.trim();
  if (ip.indexOf("ERROR") >= 0 || ip.length() < 7) {
    Serial.println("XATO: IP manzil olinmadi");
    return false;
  }
  Serial.print("   IP manzil: ");
  Serial.println(ip);
  Serial.println("--- Modem TAYYOR ---");
  return true;
}
