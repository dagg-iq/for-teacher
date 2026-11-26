-- مخطط نَهج لقاعدة Oracle (19c فأحدث، ومنها Autonomous Database).
-- مولَّد من server/src/schema.mjs — لا تعدّله يدوياً: عدّل المصدر ثم «npm run ddl».
-- كل صف يتبع مدرساً (owner_id = هوية الحساب من رمز الدخول)، و synced_at يضبطه الخادم للسحب التزايدي.

CREATE TABLE "classes" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "name" NVARCHAR2(500),
  "stage" NVARCHAR2(500),
  "subject" NVARCHAR2(500),
  "hue" NUMBER(10),
  "sort" NUMBER(10),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "classes_owner_synced" ON "classes" ("owner_id", "synced_at");

CREATE TABLE "sections" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "class_id" VARCHAR2(36),
  "name" NVARCHAR2(500),
  "room" NVARCHAR2(500),
  "sort" NUMBER(10),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "sections_owner_synced" ON "sections" ("owner_id", "synced_at");

CREATE TABLE "students" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "section_id" VARCHAR2(36),
  "name" NVARCHAR2(500),
  "number" NUMBER(10),
  "parent_phone" NVARCHAR2(500),
  "notes" NCLOB,
  "gender" NVARCHAR2(500),
  "sort" NUMBER(10),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "students_owner_synced" ON "students" ("owner_id", "synced_at");

CREATE TABLE "gradebooks" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "section_id" VARCHAR2(36),
  "title" NVARCHAR2(500),
  "template" NVARCHAR2(500),
  "columns" CLOB CHECK ("columns" IS JSON),
  "result" CLOB CHECK ("result" IS JSON),
  "year" NVARCHAR2(500),
  "note" NCLOB,
  "archived" NUMBER(1) DEFAULT 0 NOT NULL,
  "pinned" NUMBER(1) DEFAULT 0 NOT NULL,
  "group_id" VARCHAR2(36),
  "role" NVARCHAR2(500),
  "ord" NUMBER(10),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "gradebooks_owner_synced" ON "gradebooks" ("owner_id", "synced_at");

CREATE TABLE "grades" (
  "id" VARCHAR2(200) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "gradebook_id" VARCHAR2(36),
  "student_id" VARCHAR2(36),
  "column_id" VARCHAR2(120),
  "value" BINARY_DOUBLE,
  "mark" NVARCHAR2(500),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "grades_owner_synced" ON "grades" ("owner_id", "synced_at");

CREATE TABLE "attendance" (
  "id" VARCHAR2(200) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "section_id" VARCHAR2(36),
  "student_id" VARCHAR2(36),
  "date" VARCHAR2(10),
  "status" NVARCHAR2(500),
  "note" NCLOB,
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "attendance_owner_synced" ON "attendance" ("owner_id", "synced_at");

CREATE TABLE "slots" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "day" NUMBER(10),
  "period" NUMBER(10),
  "section_id" VARCHAR2(36),
  "label" NVARCHAR2(500),
  "room" NVARCHAR2(500),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "slots_owner_synced" ON "slots" ("owner_id", "synced_at");

CREATE TABLE "tasks" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "title" NVARCHAR2(500),
  "note" NCLOB,
  "kind" NVARCHAR2(500),
  "due" TIMESTAMP(6) WITH TIME ZONE,
  "remind" NUMBER(10),
  "done" NUMBER(1) DEFAULT 0 NOT NULL,
  "section_id" VARCHAR2(36),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "tasks_owner_synced" ON "tasks" ("owner_id", "synced_at");

CREATE TABLE "lesson_plans" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "date" VARCHAR2(10),
  "class_id" VARCHAR2(36),
  "section_ids" CLOB CHECK ("section_ids" IS JSON),
  "title" NVARCHAR2(500),
  "objectives" NCLOB,
  "materials" NCLOB,
  "method" NCLOB,
  "steps" NCLOB,
  "evaluation" NCLOB,
  "homework" NCLOB,
  "done" NUMBER(1) DEFAULT 0 NOT NULL,
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "lesson_plans_owner_synced" ON "lesson_plans" ("owner_id", "synced_at");

CREATE TABLE "student_notes" (
  "id" VARCHAR2(36) PRIMARY KEY,
  "owner_id" VARCHAR2(64) NOT NULL,
  "student_id" VARCHAR2(36),
  "kind" NVARCHAR2(500),
  "text" NCLOB,
  "date" VARCHAR2(10),
  "created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "deleted" NUMBER(1) DEFAULT 0 NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
CREATE INDEX "student_notes_owner_synced" ON "student_notes" ("owner_id", "synced_at");

CREATE TABLE "teacher_settings" (
  "owner_id" VARCHAR2(64) PRIMARY KEY,
  "profile" CLOB CHECK ("profile" IS JSON),
  "timetable" CLOB CHECK ("timetable" IS JSON),
  "prefs" CLOB CHECK ("prefs" IS JSON),
  "updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  "synced_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);
