import { findOrCreateUser } from "./user.service";

async function main() {
  const user = await findOrCreateUser({
    telegramId: BigInt(123456789),
    firstName: "Test",
    lastName: "Student",
    username: "teststudent",
  });

  console.log("User created/found:");
  console.log(user);
}

main().catch((error) => {
  console.error("User test failed:");
  console.error(error);
  process.exit(1);
});