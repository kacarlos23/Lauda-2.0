-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstrument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Instrument_tenantId_idx" ON "Instrument"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_tenantId_name_key" ON "Instrument"("tenantId", "name");

-- CreateIndex
CREATE INDEX "UserInstrument_tenantId_idx" ON "UserInstrument"("tenantId");

-- CreateIndex
CREATE INDEX "UserInstrument_instrumentId_idx" ON "UserInstrument"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInstrument_userId_instrumentId_key" ON "UserInstrument"("userId", "instrumentId");

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstrument" ADD CONSTRAINT "UserInstrument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstrument" ADD CONSTRAINT "UserInstrument_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstrument" ADD CONSTRAINT "UserInstrument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
