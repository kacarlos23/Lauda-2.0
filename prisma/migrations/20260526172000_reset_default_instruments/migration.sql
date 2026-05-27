CREATE EXTENSION IF NOT EXISTS pgcrypto;

DELETE FROM "UserInstrument";
DELETE FROM "Instrument";

INSERT INTO "Instrument" ("id", "name", "colorHex", "tenantId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    defaults.name,
    defaults."colorHex",
    "Tenant"."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Tenant"
CROSS JOIN (
    VALUES
        ('Vocalista', '#10B981'),
        ('Violão', '#F59E0B'),
        ('Guitarra', '#EF4444'),
        ('Baixo', '#8B5CF6'),
        ('Bateria', '#DC2626'),
        ('Teclado', '#2563EB'),
        ('Piano', '#2563EB'),
        ('Violino', '#A855F7'),
        ('Flauta', '#14B8A6'),
        ('Mesa de Som', '#0F766E'),
        ('Saxofone', '#D97706'),
        ('Back Vocal', '#22C55E'),
        ('Multimídia', '#7C3AED')
) AS defaults(name, "colorHex");
