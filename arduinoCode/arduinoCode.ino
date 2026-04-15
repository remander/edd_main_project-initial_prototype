/*
  MyoWare BLE Central Example Code
  Advancer Technologies, LLC
  Brian Kaminski
  8/01/2023

  This example sets up a BLE Central device, Then, it connects
  to up to four MyoWare 2.0 Wireless Shields that are reading the ENV and RAW
  outputs of a MyoWare Muscle sensor. It then streams the selected output data
  (ENVELOPE or RAW) from all sensors on the Serial Terminal.

  Note, in BLE, you have services, characteristics and values.
  Read more about it here:
  https://www.arduino.cc/reference/en/libraries/arduinoble/

  Note, before it begins checking the data and printing it,
  It first sets up some BLE stuff:
    1. sets up as a central
    2. scans for and connects to any MyoWare 2.0 Wireless Shields for 10 seconds

  In order for this example to work, you will need a MyoWare 2.0 Wireless Shield,
  and it will need to be programmed with the MyoWare BLEnPeripheral code,
  and advertizing with the unique and correlating characteristic UUID.

  Note, both the service and the characteristic need unique UUIDs and each
  MyoWare 2.0 Wireless Shield needs a unique name (e.g. MyoWareSensor1, MyoWareSensor2)

  This "BLE Central", will read each MyoWare 2.0 Wireless Sensor,
  aka the "BLE Peripheral", charactieristic, parse it for the ENV and RAW values,
  and print them to the serial terminal.

  Hardware:
  BLE device (e.g. ESP32) 
  USB from BLE device to Computer.

  ** For consistent BT connection follow these steps:
  ** 1. Reset Peripheral
  ** 2. Wait 5 seconds
  ** 3. Reset Central
  ** 4. Enjoy BT connection
  **
  ** ArduinoBLE does not support RE-connecting two devices.
  ** If you loose connection, you must follow this hardware reset sequence again.
  **
  ** ArduinoBLE does not support connecting more than four peripheral devices.

  This example code is in the public domain.
*/
/*
  MyoWare BLE Central Example Code
  Advancer Technologies, LLC
  Brian Kaminski
  8/01/2023

  ...[rest of header comments unchanged]...
*/

/*
  MyoWare BLE Central Example Code
  Advancer Technologies, LLC
  Brian Kaminski
  8/01/2023

  This example sets up a BLE Central device, then connects
  to up to four MyoWare 2.0 Wireless Shields and streams
  their data (ENVELOPE or RAW) over HTTP to a server.
*/

#include <ArduinoBLE.h>
#include <MyoWare.h>
#include <vector>
#include <algorithm>

#include <SPI.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "arduino_secrets.h"

// debug parameters
const bool debugLogging = false;

// BLE peripherals list
std::vector<BLEDevice> vecMyoWareShields;
MyoWare myoware;

// Wi-Fi creds in arduino_secrets.h
char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;

// Server IP (change to the target)
IPAddress server(192,168,137,117);

WiFiClient client;
unsigned long lastConnectionTime = 0;
const unsigned long postingInterval = 10L * 50L; // ~1 s

void setup() {
  // 1) Serial + 2 s timeout for monitor
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 2000) { /* wait */ }
  Serial.println(">>> setup start");

  // 2) BLE init
  pinMode(myoware.getStatusLEDPin(), OUTPUT);
  if (!BLE.begin()) {
    Serial.println("Starting BLE failed!");
    while (1);
  }
  if (debugLogging) {
    Serial.println("MyoWare BLE Central");
    Serial.println("-------------------");
  }

  // 3) Scan/connect peripherals for 10 s
  BLE.scanForUuid(MyoWareBLE::uuidMyoWareService.c_str(), true);
  unsigned long scanStart = millis();
  while (millis() - scanStart < 10000) {
    myoware.blinkStatusLED();
    BLEDevice p = BLE.available();
    if (p && std::find(vecMyoWareShields.begin(), vecMyoWareShields.end(), p) == vecMyoWareShields.end()) {
      if (debugLogging) {
        Serial.print("Connecting to "); PrintPeripheralInfo(p);
      }
      BLE.stopScan();
      if (p.connect() && p.discoverAttributes()) {
        vecMyoWareShields.push_back(p);
      } else {
        p.disconnect();
      }
      BLE.scanForUuid(MyoWareBLE::uuidMyoWareService.c_str(), true);
    }
  }
  BLE.stopScan();

  if (vecMyoWareShields.empty()) {
    Serial.println("No MyoWare Shields found! Restarting in 5 s...");
    delay(5000);
    ESP.restart();
  }

  digitalWrite(myoware.getStatusLEDPin(), HIGH);
  for (auto &shield : vecMyoWareShields) {
    Serial.println(shield.localName());
  }

  // Wi-Fi connect
  Serial.print("Connecting to SSID: "); Serial.println(ssid);
  WiFi.begin(ssid, pass);
  uint8_t wifiStatus = WiFi.waitForConnectResult();  // blocks until done
  if (wifiStatus == WL_CONNECTED) {
    Serial.print("Wi-Fi connected, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.print("Wi-Fi failed, status = ");
    Serial.println(wifiStatus);
    delay(5000);
    ESP.restart();
  }

  Serial.println(">>> setup complete");
}

void loop() {
  // Serial.println(">>> loop start");

  // Print any pending HTTP responses
  String resp;
  while (client.available()) {
    resp += char(client.read());
  }
  if (resp.length()) {
    Serial.println(resp);
  }

  // Send new GET ~once/sec
  if (millis() - lastConnectionTime > postingInterval) {
    httpRequest();
  }
}

// Read sensor data from MyoWare Shields
// Returns a string with the format "val1xval2|status1,status2"
String sensorRead() {
  double val1 = 0.0;
  double val2 = 0.0;
  bool sensor1Connected = false;
  bool sensor2Connected = false;

  for (auto &shield : vecMyoWareShields) {
    String name = shield.localName();
    double val = 0.0;
    bool isConnected = false;

    if (!shield.connected()) {
      val = 0.0;
      isConnected = false;
    } else {
      BLEService svc = shield.service(MyoWareBLE::uuidMyoWareService.c_str());
      if (!svc) {
        shield.disconnect();
        val = 0.0;
        isConnected = false;
      } else {
        BLECharacteristic chr = svc.characteristic(MyoWareBLE::uuidMyoWareCharacteristic.c_str());
        val = ReadBLEData(chr);
        isConnected = true;
      }
    }

    if (name == "MyoWareSensor1") {
      val1 = val;
      sensor1Connected = isConnected;
    } else if (name == "MyoWareSensor2") {
      val2 = val;
      sensor2Connected = isConnected;
    }
  }

  String combined = String(val1, 3) + "x" + String(val2, 3);
  String statusString = String(sensor1Connected ? "True" : "False") + "," + String(sensor2Connected ? "True" : "False");
  String result = combined + "|" + statusString;
  
  Serial.println("Combined value: " + combined);
  Serial.println("Status: " + statusString);
  Serial.println("Full result: " + result);
  Serial.print("Sensor 1: "); 
  Serial.println(val1);
  Serial.print("Sensor 2: "); 
  Serial.println(val2);
  
  return result;
}

void httpRequest() {
  client.stop();
  String valString = sensorRead();
  
  // Extract status portion 
  int separatorIndex = valString.indexOf('|');
  String combinedValue = valString;
  String statusString = "";
  
  if (separatorIndex != -1) {
    combinedValue = valString.substring(0, separatorIndex);
    statusString = valString.substring(separatorIndex + 1);
  }

  if (client.connect(server, 5000)) {
    Serial.println("connecting...");
    String req = "GET /test?combined=" + valString + " HTTP/1.1";
    client.println(req);
    client.println("Host: 10.0.0.176");  // match the server
    client.println("User-Agent: ArduinoWiFi/1.1");
    client.println("Connection: close");
    client.println();
    
    // Second request to update status node
    client.stop();
    if (client.connect(server, 5000)) {
      String statusReq = "GET /updateStatus?status=" + statusString + " HTTP/1.1";
      client.println(statusReq);
      client.println("Host: 10.0.0.176");  // print the server IP, should match the server
      client.println("User-Agent: ArduinoWiFi/1.1");
      client.println("Connection: close");
      client.println();
      
      Serial.println("Status update request sent: " + statusReq);
    }
    
    lastConnectionTime = millis();
  } else {
    Serial.println("connection failed");
  }
}

double ReadBLEData(BLECharacteristic &c) {
  if (c && c.canRead()) {
    char buf[20];
    c.readValue(buf, 20);
    String s(buf);
    if (debugLogging) {
      Serial.print("Raw BLE data: "); Serial.println(s);
    }
    return s.toDouble();
  }
  return 0.0;
}

void PrintPeripheralInfo(BLEDevice p) {
  Serial.print(p.address());
  Serial.print(" '"); Serial.print(p.localName());
  Serial.print("' "); Serial.println(p.advertisedServiceUuid());
}
