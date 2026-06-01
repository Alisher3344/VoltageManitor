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

// Backend TCP listener (port 5001) ochiq turgan manzil.
// Backend lokal bo'lsa — Pinggy tunnel orqali oching:
//   ssh -p 443 -R0:localhost:5001 tcp@a.pinggy.io
// va chiqqan IP:PORT ni shu yerga yozing (SIM800L domen emas, IP kutadi):
const char* HOST = "172.235.171.65";  // pinggy tunnel IPv4 (run.pinggy-free.link)
const int   PORT = 35081;             // pinggy tunnel porti
// ====================================

String        deviceId  = "";    // NVS'dan yuklanadi
int           lastValue = -1;
bool          tcpOpen    = false;
unsigned long lastSendMs = 0;
String        cliBuf     = "";    // Serial buyruq buferi

// -------- ID saqlash (NVS / Preferences) --------
void loadId() {
  prefs.begin("voltage", true);                       // read-only
  deviceId = prefs.getString("id", DEFAULT_DEVICE_ID); // fleshда bo'lmasa - koddagi standart
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
      if (urc.indexOf("CLOSED") >= 0) tcpOpen = false;
      urc = "";
    }
    if (urc.length() > 64) urc = "";
  }

  // ID o'rnatilmaган bo'lsa — yubormaymiz
  if (!deviceId.length()) {
    delay(200);
    return;
  }

  // Ulanish uzilgan bo'lsa — har 20s modemni qayta tekshirib ulaymiz
  static unsigned long lastReinit = 0;
  if (!tcpOpen && millis() - lastReinit > 20000) {
    lastReinit = millis();
    Serial.println("Qayta ulanish...");
    if (initModem()) openTcp();
  }

  // Tashqi signal: 3.3V -> HIGH -> 1, 0V -> LOW -> 0
  int value = digitalRead(SIGNAL_PIN);

  if (value != lastValue) {
    Serial.printf("Holat: %d\n", value);
    // Faqat muvaffaqiyatli yuborilgandagina yangilaymiz
    if (sendToServer(value)) lastValue = value;
  }

  // Keepalive — har 30s holatni qayta yuboradi
  if (tcpOpen && lastValue >= 0 && millis() - lastSendMs > 30000) {
    sendToServer(lastValue);
  }

  delay(20);
}

bool openTcp() {
  String cmd = "AT+CIPSTART=\"TCP\",\"" + String(HOST) + "\"," + String(PORT);
  Serial.print("  >> "); Serial.println(cmd);
  String resp = sendATGetResp(cmd.c_str(), 10000);
  Serial.print("  << "); Serial.println(resp);

  if (resp.indexOf("CONNECT OK") >= 0 || resp.indexOf("ALREADY CONNECT") >= 0) {
    tcpOpen = true;
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

bool sendToServer(int value) {
  if (!tcpOpen && !openTcp()) {
    Serial.println("  X (ulanmadi)");
    return false;
  }

  // Format: "ID:value\n"   masalan "11:1\n"  (sayt shu ID bo'yicha topadi)
  String msg = deviceId + ":" + String(value) + "\n";

  String sendCmd = "AT+CIPSEND=" + String(msg.length());
  String r = sendATGetResp(sendCmd.c_str(), 800);
  if (r.indexOf(">") < 0) {
    tcpOpen = false;
    if (openTcp()) return sendToServer(value);
    return false;
  }

  sim800.print(msg);
  lastSendMs = millis();
  Serial.print("  OK -> "); Serial.print(msg);
  return true;
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

// Modemni bosqichma-bosqich tekshirib ishga tushiradi
bool initModem() {
  Serial.println("--- Modem tekshiruvi ---");

  if (!atExpect("AT", "OK", 2000)) {
    Serial.println("XATO: modem javob bermayapti (TXD/RXD ulanishi yoki 5V quvvat?)");
    return false;
  }
  if (!atExpect("AT+CPIN?", "READY", 3000)) {
    Serial.println("XATO: SIM yo'q / PIN kerak / noto'g'ri o'rnatilgan");
    return false;
  }

  int csq = readCsq();
  Serial.printf("   Signal (CSQ): %d  %s\n", csq,
                (csq == 99 || csq == 0) ? "<- SIGNAL YO'Q (antennani tekshiring!)"
                : (csq < 10) ? "(kuchsiz)" : "(yaxshi)");

  Serial.print("   Tarmoqqa ulanish");
  if (!waitNetwork(30000)) {
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
