import vine, { SimpleMessagesProvider } from '@vinejs/vine'

vine.messagesProvider = new SimpleMessagesProvider({
  'required': 'O campo {{field}} é obrigatório',
  'string': 'O campo {{field}} deve ser do tipo string',
  'email': 'O email fornecido não é válido',
  'uuid': 'Este ID não é válido',
  'database.exists': 'Este registro não existe',
  'database.unique': 'Este {{field}} já está em uso',
  'file.extname': 'Este arquivo não é suportado, apenas {{extnames}} são permitidos',
  'confirmed': 'O campo {{field}} deve ser igual ao campo {{otherField}}',
})
