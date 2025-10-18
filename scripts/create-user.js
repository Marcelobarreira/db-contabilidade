const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

async function main() {
  const email = "marcelobarreiradev@outlook.com";
  const password = "pokemon360";
  const hashedPassword = hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      admin: true,
    },
    create: {
      email,
      password: hashedPassword,
      admin: true,
    },
  });

  console.log("Usuário criado/atualizado com sucesso:", {
    id: user.id,
    email: user.email,
    admin: user.admin,
  });
}

main()
  .catch((error) => {
    console.error("Erro ao criar usuário:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
