import * as z from "zod";

export const LoginSchema = z.object({
  email: z.email("Insira um e-mail válido").min(1, "Preencha com seu e-mail"),
  password: z.string().min(1, "Informe uma senha"),
});
