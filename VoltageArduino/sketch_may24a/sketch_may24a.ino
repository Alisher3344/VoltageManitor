// ESP32-C3 Super Mini + SIM800L V2 EVB
// Arduino IDE: Tools > Board > ESP32C3 Dev Module
//              Tools > USB CDC On Boot > Enabled  (Serial Monitor uchun MUHIM)
//
// Ulanish (SIM800L V2 EVB):
//   V2 VDD       -> ESP32 3V3       (UART logic level 3.3V'da)
//   V2 TXD       -> ESP32 GPIO 20 (RX)
//   V2 RXD       -> ESP32 GPIO 21 (TX)
//   V2 GND       -> ESP32 GND  (umumiy)
//   V2 5VIN      -> ALOHIDA 5V 2A manba
//
//   3.3V signal manbai -> ESP32 GPIO 3 (umumiy GND bilan)

#include <HardwareSerial.h>

HardwareSerial sim800(1);   // UART1

// ============ SOZLAMALAR ============

const int SIM_RX_PIN = 20;  // ESP32 RX <- SIM800L TX
const int SIM_TX_PIN = 21;  // ESP32 TX -> SIM800L RX

const char* APN  = "internet";

// Pinggy TCP tunnel: IP va PORT
// (SIM800L DNS uzun pinggy domenni hal qila olmaydi - bevosita IP yozamiz.
//  Pinggy qayta ishga tushganda IP va PORT yangilanadi.)
const char* HOST = "172.232.203.221";
const int   PORT = 35229;     // ESP32-da int 32-bit, overflow yo'q

// Qurilma ID - har bir ESP32'da BOSHQACHA bo'lsin!
// Brauzer shu ID bo'yicha qurilmani ajratadi.
const char* DEVICE_ID = "11";

const int SIGNAL_PIN = 3;   // 3.3V signal to'g'ridan-to'g'ri (bo'luvchi kerak emas)

// ====================================

int  lastValue = -1;
bool tcpOpen   = false;
unsigned long lastSendMs = 0;

void setup() {
  Serial.begin(115200);
  sim800.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  pinMode(SIGNAL_PIN, INPUT_PULLDOWN);   // signal yo'qida 0, 3.3V kelsa 1

  delay(3000);
  Serial.println("=== Setup ===");

  showResp("AT", 1000);
  showResp("AT+CPIN?", 1000);
  showResp("AT+CSQ", 1000);
  showResp("AT+CREG?", 1000);
  showResp("AT+CGATT?", 2000);
  showResp("AT+CIPSHUT", 2000);
  showResp("AT+CIPMUX=0", 500);
  String apnCmd = "AT+CSTT=\"" + String(APN) + "\"";
  showResp(apnCmd.c_str(), 1000);
  showResp("AT+CIICR", 8000);
  showResp("AT+CIFSR", 2000);
  showResp("AT+CIPSTATUS", 1000);

  Serial.println("=== Tayyor ===");
  openTcp();
}

void loop() {
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

  // Tashqi signal: 3.3V -> HIGH -> 1, 0V -> LOW -> 0
  int value = digitalRead(SIGNAL_PIN);

  if (value != lastValue) {
    Serial.printf("Holat: %d\n", value);
    sendToServer(value);
    lastValue = value;
  }

  if (tcpOpen && millis() - lastSendMs > 30000) {
    sendToServer(lastValue);   // keepalive
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

void sendToServer(int value) {
  if (!tcpOpen && !openTcp()) {
    Serial.println("  X");
    return;
  }

  // Format: "ID:value\n"  masalan "11:1\n"
  String msg = String(DEVICE_ID) + ":" + String(value) + "\n";

  String sendCmd = "AT+CIPSEND=" + String(msg.length());
  String r = sendATGetResp(sendCmd.c_str(), 800);
  if (r.indexOf(">") < 0) {
    tcpOpen = false;
    if (openTcp()) sendToServer(value);
    return;
  }

  sim800.print(msg);
  lastSendMs = millis();
  Serial.println("  OK");
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
