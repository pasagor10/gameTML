# ไอคอน UI แบบวาดด้วย AI

เกมวาดไอคอนเป็น SVG ไว้ให้แล้ว ถ้าอยากได้ภาพ AI ที่สวยกว่า:

1. เจนภาพตามพรอมป์ต์ด้านล่าง (ChatGPT / Codex / เครื่องมืออื่น) แนบ `assets/generated/v1/slime-leaf.png` เป็น style reference
2. ได้ภาพแล้วตัดพื้นหลังให้โปร่งใส ครอปเป็นสี่เหลี่ยมจัตุรัส ย่อเหลือ 256×256 แล้วบันทึกเป็น `assets/ui/icons/<ชื่อ>.png`
3. ใส่ชื่อไอคอนลงใน `manifest.json` เช่น `["coin","potion"]` แล้วรีเฟรชเกม ภาพ AI จะแทน SVG ทันที

## พรอมป์ต์ร่วม (ต่อท้ายทุกไอคอน)

> single game UI icon, chunky 2.5D cartoon style matching the reference slime, thick dark-brown outline, glossy highlights, soft cel shading, vibrant saturated colours, centered, slight 3/4 view, fills 85% of frame, plain transparent background, no text, no border, no shadow on ground

## รายการไอคอน

| ชื่อไฟล์ | ใช้ที่ | พรอมป์ต์ |
|---|---|---|
| coin | ช่องเงิน | a shiny gold coin with an embossed star, thick rim, sparkle glint |
| skull | จำนวนที่ฆ่า | a cute round cartoon skull, white bone with pink glowing eyes |
| potion | ปุ่มยา | a round glass potion flask with bright red healing liquid, cork stopper, bubbles |
| magnet | ปุ่มดูด EXP | a red horseshoe magnet with silver tips and cyan electric sparks |
| town | ปุ่มเมือง | a small fairy-tale castle with blue cone roofs and a red flag |
| map | ปุ่มแผนที่ | an unfolded treasure map parchment with dotted path and red X |
| skills | ปุ่มสกิล | an open purple spellbook with a glowing golden star floating above it |
| bag | ปุ่มตัวละคร | a brown leather adventurer backpack with a gold buckle |
| play | AUTO ปิดอยู่ | a glossy green play-triangle button symbol |
| hold | AUTO เปิดอยู่ | a glossy white pause symbol (two rounded bars) |
| pause | ปุ่มหยุดเกม | a glossy gold pause symbol (two rounded bars) |
| sound | เสียงเปิด | a gold speaker with sound waves |
| mute | เสียงปิด | a grey speaker with a red X |
| power | พลังต่อสู้ | two crossed steel swords with gold hilts |
| heart | หลอด HP | a glossy red heart |
| crystal | หลอด EXP | a faceted purple magic crystal shard |
