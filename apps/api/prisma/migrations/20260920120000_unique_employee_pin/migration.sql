-- Spec 044: el PIN es la unica credencial de la pista, asi que dos empleados no
-- pueden compartirlo (RN-3). Los hashes bcrypt que quedan de la spec 003 son
-- unicos entre si, por lo que el indice entra sin conflictos; ya no sirven para
-- entrar y oficina reasigna cada PIN una vez (RN-5).
CREATE UNIQUE INDEX "employees_pinHash_key" ON "employees"("pinHash");
