-- Quien cobro viaja en el ticket (spec 053).
--
-- La columna `recordedByUserId` existe desde la 003 y siempre se lleno con el
-- usuario de la sesion; lo unico que falta es la relacion para leer su nombre
-- sin una segunda consulta. Ningun dato cambia.

-- CreateIndex
CREATE INDEX "payments_recordedByUserId_idx" ON "payments"("recordedByUserId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
