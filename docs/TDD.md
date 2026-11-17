# TECHNICAL DESIGN DOCUMENT (TDD)
## ตำนาน 3 อัศวิน — Tham Luang Dungeon
**Version:** 1.0  
**Target:** Demo v0.1  
**Architecture:** Server-Authoritative 2D MMORPG  
**Primary Stack:** Node.js, Express, Phaser 3, Socket.IO, SQLite

---

# 1. System Architecture

## 1.1 ภาพรวม

แบ่งระบบเป็น 4 ส่วน

**Game Client**
- Phaser 3 สำหรับแสดงเกม
- HTML/CSS สำหรับ UI
- Socket.IO Client สำหรับ Real-time
- REST API สำหรับข้อมูลที่ไม่ต้องอัปเดตทันที

**Game Server**
- Node.js + Express
- Socket.IO Server
- World Manager
- Dungeon Instance Manager
- Combat Engine
- Auto Battle Engine
- Economy Services

**Database**
- SQLite
- better-sqlite3
- WAL Mode
- Foreign Keys
- Transaction Management

**Shared**
- Item Definitions
- Class Definitions
- Dungeon Configuration
- Monster Configuration
- Protocol Schemas

## 1.2 การไหลของข้อมูล

```text
Browser
  |
  | HTTPS / REST
  | WSS / Socket.IO
  v
Nginx
  |
  v
Node.js Game Server
  |
  +-- Authentication
  +-- World Manager
  +-- Movement System
  +-- Combat Engine
  +-- Auto Battle
  +-- Dungeon Manager
  +-- Party Manager
  +-- Inventory Service
  +-- Economy Service
  |
  v
SQLite Database
```

Client ห้ามแก้ไขข้อมูลสำคัญโดยตรง เช่น Gold, EXP, HP, Damage, Item Quantity หรือ Upgrade Result

---

# 2. Project Structure

```text
thamluang-mmorpg/
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── main.js
│   │   ├── config/
│   │   ├── scenes/
│   │   │   ├── BootScene.js
│   │   │   ├── LoginScene.js
│   │   │   ├── CharacterScene.js
│   │   │   ├── TownScene.js
│   │   │   └── DungeonScene.js
│   │   ├── entities/
│   │   │   ├── Player.js
│   │   │   ├── Monster.js
│   │   │   └── NPC.js
│   │   ├── systems/
│   │   │   ├── Movement.js
│   │   │   ├── Combat.js
│   │   │   ├── AutoBattle.js
│   │   │   └── Animation.js
│   │   ├── network/
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   └── ui/
│   └── public/assets/
│       ├── characters/
│       ├── monsters/
│       ├── maps/
│       ├── skills/
│       ├── items/
│       └── audio/
├── server/
│   ├── src/
│   │   ├── index.js
│   │   ├── config/
│   │   ├── routes/
│   │   ├── socket/
│   │   ├── middleware/
│   │   ├── managers/
│   │   │   ├── WorldManager.js
│   │   │   ├── ChannelManager.js
│   │   │   ├── DungeonManager.js
│   │   │   └── PartyManager.js
│   │   ├── services/
│   │   │   ├── CombatService.js
│   │   │   ├── AutoBattleService.js
│   │   │   ├── InventoryService.js
│   │   │   ├── ShopService.js
│   │   │   ├── TradeService.js
│   │   │   └── EnhancementService.js
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   ├── repositories/
│   │   │   └── seed/
│   │   └── utils/
│   └── tests/
├── shared/
│   ├── config/
│   │   ├── classes.json
│   │   ├── skills.json
│   │   ├── items.json
│   │   ├── monsters.json
│   │   └── dungeons.json
│   └── schemas/
├── docs/
│   ├── GDD.md
│   ├── TDD.md
│   └── API.md
├── .env.example
└── package.json
```

---

# 3. Database Design

ใช้ SQLite สำหรับ Demo และเตรียม Repository Layer เพื่อรองรับการย้ายไป PostgreSQL ในอนาคต

## 3.1 ตารางบัญชี

**users**
- id INTEGER PRIMARY KEY
- username TEXT UNIQUE NOT NULL
- password_hash TEXT NOT NULL
- status TEXT DEFAULT 'active'
- created_at INTEGER NOT NULL
- last_login_at INTEGER

**characters**
- id INTEGER PRIMARY KEY
- user_id INTEGER NOT NULL
- name TEXT UNIQUE NOT NULL
- gender TEXT NOT NULL
- class TEXT NOT NULL
- level INTEGER DEFAULT 1
- exp INTEGER DEFAULT 0
- gold INTEGER DEFAULT 0
- hp INTEGER
- mp INTEGER
- current_map TEXT
- current_channel INTEGER
- position_x REAL
- position_y REAL
- created_at INTEGER

ข้อกำหนด:
- หนึ่งบัญชีมีตัวละครสูงสุด 3 ตัว
- ตรวจสอบความเป็นเจ้าของตัวละครทุก API
- บันทึกตำแหน่งที่ปลอดภัยเมื่อออกเกม
- ใช้ INTEGER สำหรับจำนวน Gold

## 3.2 ตารางไอเทม

**item_definitions**
- id
- code UNIQUE
- name
- type
- rarity
- class_requirement
- level_requirement
- base_atk
- base_def
- stack_limit
- tradeable
- sell_price

**inventory_items**
- id INTEGER PRIMARY KEY
- character_id
- item_definition_id
- quantity
- enhancement_level
- equipped_slot
- location
- version
- created_at

ค่า location:
- inventory
- equipped
- shop_escrow
- trade_escrow

ต้องใช้ Item Instance ID เฉพาะสำหรับอุปกรณ์ที่มีคุณสมบัติต่างกัน

## 3.3 ตารางดันเจียน

**dungeon_floors**
- id
- floor_number
- name
- recommended_level
- required_floor
- theme
- boss_id

**dungeon_stages**
- id
- floor_id
- stage_number
- map_id
- monster_config
- completion_condition

**character_progress**
- character_id
- highest_unlocked_floor
- highest_completed_floor
- updated_at

**dungeon_instances**
- id
- party_id
- floor_number
- stage_number
- status
- created_at
- expires_at

สถานะ Instance:
- preparing
- active
- completed
- failed
- closed

## 3.4 ตารางเศรษฐกิจ

**player_shops**
- id
- owner_character_id
- name
- map_id
- channel_id
- position_x
- position_y
- status

**shop_listings**
- id
- shop_id
- inventory_item_id
- quantity
- unit_price
- status

**trade_sessions**
- id
- player_a_id
- player_b_id
- status
- revision
- expires_at

**trade_entries**
- id
- trade_id
- owner_character_id
- inventory_item_id
- quantity
- gold_amount

**currency_ledger**
- id
- transaction_id
- character_id
- delta
- balance_after
- reason
- created_at

**enhancement_logs**
- id
- character_id
- inventory_item_id
- before_level
- after_level
- success
- cost_gold
- created_at

ใช้ Transaction ID ที่ไม่ซ้ำกันเพื่อป้องกันการทำรายการซ้ำ

---

# 4. REST API Design

API Prefix: `/api/v1`

## 4.1 Authentication

| Method | Endpoint | หน้าที่ |
|---|---|---|
| POST | /auth/register | สมัครสมาชิก |
| POST | /auth/login | เข้าสู่ระบบ |
| POST | /auth/logout | ออกจากระบบ |
| GET | /auth/me | ข้อมูลผู้ใช้ |

ใช้ Secure HttpOnly Cookie Session สำหรับ Browser และกำหนด SameSite, CSRF Protection ตามรูปแบบการใช้งาน

## 4.2 Character

| Method | Endpoint | หน้าที่ |
|---|---|---|
| GET | /characters | รายชื่อตัวละคร |
| POST | /characters | สร้างตัวละคร |
| GET | /characters/:id | ข้อมูลตัวละคร |
| POST | /characters/:id/select | เลือกตัวละคร |

## 4.3 Inventory และ Shop

| Method | Endpoint | หน้าที่ |
|---|---|---|
| GET | /inventory | ดูกระเป๋า |
| POST | /inventory/equip | สวมอุปกรณ์ |
| POST | /inventory/unequip | ถอดอุปกรณ์ |
| GET | /npc-shops/:id | ดูสินค้า NPC |
| POST | /npc-shops/:id/buy | ซื้อสินค้า |
| POST | /player-shops | เปิดร้าน |
| POST | /player-shops/:id/listings | วางขาย |
| POST | /player-shops/listings/:id/buy | ซื้อของผู้เล่น |
| POST | /player-shops/:id/close | ปิดร้าน |
| POST | /equipment/enhance | ตีบวก |

ทุก API ที่เปลี่ยนเงินหรือไอเทมต้องใช้ Transaction และตรวจสอบสิทธิ์เจ้าของข้อมูล

---

# 5. Socket.IO Protocol

Namespace หลัก: `/game`

## 5.1 Client → Server

| Event | Payload หลัก |
|---|---|
| player:join | characterId, channelId |
| player:input | seq, direction, jump, timestamp |
| player:attack | skillId, direction |
| player:auto | enabled |
| player:interact | npcId |
| dungeon:enter | floorId, partyId |
| dungeon:ready | instanceId |
| party:invite | targetCharacterId |
| party:accept | partyId |
| chat:send | channel, message |
| trade:request | targetCharacterId |
| trade:offer | tradeId, items, gold |
| trade:confirm | tradeId, revision |

## 5.2 Server → Client

| Event | หน้าที่ |
|---|---|
| world:snapshot | สถานะเริ่มต้นของแผนที่ |
| world:delta | สถานะที่เปลี่ยนแปลง |
| player:spawn | ผู้เล่นปรากฏ |
| player:despawn | ผู้เล่นออก |
| player:state | ตำแหน่งและสถานะ |
| combat:result | ผลการโจมตี |
| monster:spawn | มอนสเตอร์เกิด |
| monster:state | สถานะมอนสเตอร์ |
| dungeon:progress | ความคืบหน้าดันเจียน |
| inventory:updated | กระเป๋าเปลี่ยน |
| trade:updated | รายการแลกเปลี่ยน |
| shop:updated | ร้านค้าเปลี่ยน |
| chat:message | ข้อความแชต |
| game:error | ข้อผิดพลาด |

## 5.3 ตัวอย่าง Movement Input

```json
{
  "seq": 1042,
  "direction": 1,
  "jump": false,
  "timestamp": 1763350000000
}
```

Server ไม่เชื่อค่าตำแหน่งจาก Client โดยตรง

การเคลื่อนที่:
1. Client ส่ง Input
2. Server ตรวจสอบสถานะและลำดับคำสั่ง
3. Server คำนวณ Physics
4. Server ส่ง State กลับ
5. Client ใช้ Prediction และ Reconciliation
6. ผู้เล่นอื่นใช้ Interpolation

---

# 6. Game Loop & Physics

## 6.1 Server Tick

ค่าตั้งต้น:
- Simulation: 20 ticks/second
- State Broadcast: 10–15 updates/second
- Client Rendering: ตาม Refresh Rate
- Snapshot แบบเต็ม: ตอนเข้าแผนที่หรือ Reconnect

ค่าเหล่านี้ต้องปรับจากผลทดสอบจริง

## 6.2 Movement

ใช้:
- Gravity
- Horizontal Velocity
- Jump Velocity
- Collision Detection
- Platform Collision
- Ladder Movement
- Map Boundaries

Server ต้องมี Collision Map ที่สอดคล้องกับ Tiled Map ฝั่ง Client

ห้ามใช้ Client Physics เป็นหลักฐานว่าผู้เล่นผ่านกำแพงหรือถึงตำแหน่งได้จริง

---

# 7. Combat Engine

## 7.1 สูตร Damage เริ่มต้น

Physical:

```text
raw = ATK * skillMultiplier
reduced = raw * 100 / (100 + DEF)
damage = max(1, floor(reduced))
```

Magic:

```text
raw = MATK * skillMultiplier
reduced = raw * 100 / (100 + MDEF)
damage = max(1, floor(reduced))
```

Critical:

```text
if critical:
    damage = floor(damage * 1.5)
```

สูตรเป็นค่าเริ่มต้นเพื่อให้ปรับสมดุลได้ง่าย ไม่ใช่สูตรตายตัวของเกมฉบับสมบูรณ์

## 7.2 Combat Validation

Server ตรวจสอบ:
- ผู้เล่นยังมีชีวิต
- เป้าหมายอยู่ใน Instance เดียวกัน
- อยู่ในระยะโจมตี
- สกิลไม่ติด Cooldown
- มี MP เพียงพอ
- ไม่อยู่ในสถานะ Stun
- ไม่ส่งคำสั่งถี่ผิดปกติ

## 7.3 Monster AI

สถานะ:
- idle
- patrol
- chase
- attack
- return
- dead

มอนสเตอร์เลือกเป้าหมายตามระยะและ Threat โดยไม่ไล่ข้ามพื้นที่ที่เข้าถึงไม่ได้

## 7.4 Item Drop

Server เป็นผู้สุ่มจาก Loot Table

ตัวอย่าง:

```json
{
  "monster": "cave_bat",
  "drops": [
    {
      "item": "gold",
      "chance": 1.0,
      "min": 5,
      "max": 15
    },
    {
      "item": "small_hp_potion",
      "chance": 0.15,
      "quantity": 1
    }
  ]
}
```

---

# 8. Auto Battle Engine

Auto Battle เป็น Finite State Machine

```text
IDLE
  |
  v
FIND_TARGET
  |
  v
MOVE_TO_TARGET
  |
  v
ATTACK
  |
  +-- Target Dead --> FIND_TARGET
  |
  +-- HP Low --> USE_POTION
  |
  +-- No Target --> IDLE
  |
  +-- Stage Clear --> NEXT_STAGE
```

## 8.1 ข้อกำหนด

- Auto ทำงานบน Server
- เปิดได้เฉพาะ Dungeon
- Manual Input สามารถยกเลิก Auto
- เมื่อ Disconnect ให้หยุด Auto
- ห้ามเคลื่อนที่ผ่านกำแพง
- ใช้ Navigation Graph สำหรับเดินและกระโดดข้ามแพลตฟอร์ม
- ไม่อนุญาตให้ Auto สร้างไอเทมหรือรางวัลโดยตรง

---

# 9. Dungeon Instance Manager

## 9.1 การสร้าง Instance

1. หัวหน้าปาร์ตี้เลือกชั้น
2. Server ตรวจสอบสมาชิก
3. ตรวจสอบชั้นที่ปลดล็อก
4. สมาชิกกด Ready
5. สร้าง Instance ID
6. โหลด Stage Configuration
7. Spawn มอนสเตอร์
8. ย้ายสมาชิกเข้า Instance

## 9.2 การผ่านด่าน

- Stage 1: กำจัดมอนสเตอร์ครบ
- Stage 2: กำจัด Elite Monster
- Stage 3: กำจัด Boss

เมื่อผ่าน Stage 3:
- คำนวณรางวัล
- บันทึกความคืบหน้า
- ปลดล็อกชั้นถัดไป
- เปิดทางกลับเมือง

## 9.3 Disconnect

- เก็บ Instance ชั่วคราวตามเวลาที่กำหนด
- อนุญาต Reconnect เข้าห้องเดิม
- หากสมาชิกออกหมดให้ปิด Instance
- ต้องไม่ให้รางวัลซ้ำจากการ Reconnect

---

# 10. Economy Transaction Design

## 10.1 Player Shop Purchase

```text
BEGIN TRANSACTION

1. ตรวจสอบ Listing
2. ตรวจสอบสถานะร้าน
3. ตรวจสอบ Stock
4. ตรวจสอบ Gold ผู้ซื้อ
5. หัก Gold ผู้ซื้อ
6. เพิ่ม Gold ผู้ขาย
7. โอน Item Ownership
8. ลดจำนวนสินค้า
9. เขียน Currency Ledger
10. บันทึก Transaction ID

COMMIT
```

หากขั้นตอนใดล้มเหลวต้อง ROLLBACK ทั้งหมด

## 10.2 Player Trade

Trade State:
- requested
- negotiating
- confirmed_a
- confirmed_b
- committing
- completed
- cancelled
- expired

เมื่อฝ่ายใดแก้ไขรายการ:
- เพิ่ม revision
- ยกเลิกการยืนยันทั้งสองฝ่าย
- ต้องยืนยันใหม่

ตอน Commit ต้องตรวจสอบยอดเงิน ไอเทม และ revision อีกครั้งภายใน Transaction

## 10.3 Enhancement

ขั้นตอน:
1. ตรวจสอบอุปกรณ์
2. ตรวจสอบระดับสูงสุด
3. ตรวจสอบเงินและวัตถุดิบ
4. สุ่มผลบน Server
5. หักทรัพยากร
6. อัปเดตระดับ
7. บันทึก Enhancement Log
8. ส่งผลให้ Client

ต้องทำใน Transaction เดียว

---

# 11. Phaser Scene Architecture

```text
BootScene
    |
    v
LoginScene
    |
    v
CharacterScene
    |
    v
TownScene
    |
    +-- Inventory UI
    +-- NPC Shop UI
    +-- Player Shop UI
    +-- Trade UI
    +-- Party UI
    |
    v
DungeonScene
    |
    +-- Combat
    +-- Auto Battle
    +-- Monster AI Display
    +-- Stage Progress
    |
    v
TownScene
```

ใช้ Phaser Scene สำหรับโลกเกม และ HTML Overlay สำหรับหน้าต่างที่มีข้อมูลจำนวนมาก

ต้องมี UI Manager กลางเพื่อไม่ให้หลายหน้าต่างเปิดทับกันโดยไม่ตั้งใจ

---

# 12. Game Configuration

ห้าม Hardcode ข้อมูลอาชีพ ไอเทม มอนสเตอร์ และดันเจียนใน Combat Engine

ตัวอย่าง `classes.json`:

```json
{
  "swordsman": {
    "baseHp": 150,
    "baseMp": 50,
    "baseAtk": 15,
    "baseDef": 10,
    "skills": [
      "sword_slash",
      "power_strike",
      "blade_wave"
    ]
  },
  "archer": {
    "baseHp": 110,
    "baseMp": 70,
    "baseAtk": 13,
    "baseDef": 6,
    "skills": [
      "quick_shot",
      "double_arrow",
      "arrow_rain"
    ]
  },
  "mage": {
    "baseHp": 90,
    "baseMp": 150,
    "baseMatk": 18,
    "baseDef": 4,
    "skills": [
      "magic_bolt",
      "fire_ball",
      "ice_storm"
    ]
  }
}
```

ค่าตั้งต้นต้องผ่าน Validation ตอนเริ่ม Server และควรมี Configuration Version เพื่อป้องกัน Client กับ Server ใช้ข้อมูลคนละรุ่น

---

# 13. Security & Anti-Cheat

## 13.1 Authentication
- Password ใช้ Argon2id
- Session มีวันหมดอายุ
- ป้องกัน Brute Force
- ตรวจสอบ Character Ownership

## 13.2 Movement
- จำกัดความเร็ว
- ตรวจสอบ Collision
- ตรวจสอบระยะกระโดด
- ป้องกัน Teleport
- จำกัดความถี่ Input

## 13.3 Combat
- Server คำนวณ Damage
- Server ควบคุม Cooldown
- Server สุ่ม Drop
- ป้องกันคำสั่งโจมตีซ้ำ
- ตรวจสอบ Instance Membership

## 13.4 Economy
- Transaction Atomicity
- Idempotency Key
- Unique Item Ownership
- Audit Logs
- ป้องกัน Double Spend
- ป้องกัน Item Duplication

---

# 14. Performance Requirements

เป้าหมายเบื้องต้นสำหรับ Demo:

- ผู้เล่นทดสอบ 20–30 คนต่อ Channel
- รองรับหลาย Dungeon Instances
- Server Simulation 20 TPS
- ตรวจสอบ Tick Duration
- ตรวจสอบ Socket Latency
- ตรวจสอบ Memory Usage
- ตรวจสอบ Database Write Latency

จำนวนผู้เล่นที่รองรับจริงต้องยืนยันจาก Load Test

สำหรับ SQLite ให้ใช้ Single Writer Architecture และ Queue สำหรับงานเขียนที่เหมาะสม

เมื่อขยายไปหลาย Game Server ให้พิจารณา PostgreSQL, Redis และระบบ Instance Routing โดยไม่ถือว่า SQLite สามารถใช้ร่วมกันแบบ Multi-writer ข้ามหลายเครื่องได้โดยตรง

---

# 15. Logging & Monitoring

บันทึก:
- Login / Logout
- Character Create
- Dungeon Enter / Exit
- Boss Kill
- Item Drop
- Shop Purchase
- Trade
- Enhancement
- Suspicious Movement
- Server Error

ใช้ Structured JSON Logs พร้อม Request ID, Transaction ID และ Character ID

ห้ามบันทึกรหัสผ่าน Session Token หรือข้อมูลลับลง Log

---

# 16. Testing Strategy

## Unit Tests
- Damage Formula
- EXP Calculation
- Skill Cooldown
- Drop Probability
- Inventory Validation
- Enhancement Logic

## Integration Tests
- Register / Login
- Character Creation
- Player Shop Purchase
- Player Trade
- Dungeon Progress
- Disconnect / Reconnect

## Concurrency Tests
- ซื้อสินค้าชิ้นสุดท้ายพร้อมกัน
- แลกเปลี่ยนไอเทมพร้อมคำขออื่น
- กดตีบวกซ้ำอย่างรวดเร็ว
- Disconnect ระหว่างซื้อขาย
- ส่งคำขอซ้ำด้วย Transaction ID เดิม

## End-to-End Tests
- สมัครสมาชิก
- สร้างตัวละคร
- เข้าเมือง
- พบผู้เล่นอื่น
- ซื้ออาวุธ
- เข้าดันเจียน
- กำจัดบอส
- รับรางวัล
- กลับเมือง
- ตั้งร้านขายไอเทม
- Logout และ Login ใหม่

---

# 17. Deployment

ระบบเริ่มต้น:

```text
Internet
   |
 HTTPS / WSS
   |
 Nginx
   |
 Node.js Game Server (PM2)
   |
 SQLite Database
```

ข้อกำหนด:
- HTTPS
- WSS
- Environment Variables
- Database Migration
- Automated Backup
- Health Check
- Graceful Shutdown
- Process Restart
- Log Rotation

การ Backup SQLite ต้องใช้วิธีที่รองรับ WAL และตรวจสอบการ Restore ได้จริง

---

# 18. Development Phases

## Phase 1 — Foundation
- Project Setup
- Database Migration
- Login
- Character Creation
- Town Map
- Multiplayer Movement

## Phase 2 — Combat
- Character Stats
- Monster AI
- Skills
- EXP / Level
- Item Drop
- Auto Battle

## Phase 3 — Dungeon
- 3 Floors
- 9 Stages
- Boss
- Dungeon Instance
- Party
- Progress Save

## Phase 4 — Economy
- Inventory
- Equipment
- NPC Shop
- Enhancement
- Player Shop
- Offline Shop
- Player Trade

## Phase 5 — Polish
- Chibi Sprite Animation
- Mobile UI
- Sound / Effects
- Load Testing
- Security Testing
- Balance Testing

---

# 19. Definition of Done

Demo ถือว่าเสร็จเมื่อ:

- ผู้เล่นสมัครและสร้างตัวละครได้
- ผู้เล่นสองคนเห็นกันในเมือง
- เดิน กระโดด และใช้สกิลได้
- Auto/Manual ต่อสู้ได้
- ผ่านดันเจียน 3 ชั้น รวม 9 ด่านได้
- ปาร์ตี้ 3 คนลงดันเจียนร่วมกันได้
- ซื้อขาย NPC ได้
- ตั้งร้านและซื้อขายระหว่างผู้เล่นได้
- แลกเปลี่ยนไอเทมและ Gold ได้
- ตีบวกอุปกรณ์ได้
- ข้อมูลไม่สูญหายหลัง Logout
- ไม่สามารถสร้าง Gold หรือไอเทมซ้ำด้วยคำขอซ้ำ
- ระบบผ่าน Integration และ Concurrency Tests
- มี README, Migration, Seed Data และ Deployment Guide

**End of Technical Design Document v1.0**
