import Permission from '#models/permission'
import Role from '#models/role'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const permissions = await Permission.createMany([
      // Users permissions
      { name: 'view_user', label: 'Visualizar usuário', category: 'Usuários' },
      { name: 'list_user', label: 'Listar usuários', category: 'Usuários' },
      { name: 'create_user', label: 'Criar usuário', category: 'Usuários' },
      { name: 'update_user', label: 'Atualizar usuário', category: 'Usuários' },
      { name: 'delete_user', label: 'Deletar usuário', category: 'Usuários' },

      // Roles permissions
      { name: 'view_role', label: 'Visualizar função', category: 'Cargos' },
      { name: 'list_role', label: 'Listar funções', category: 'Cargos' },
      { name: 'create_role', label: 'Criar função', category: 'Cargos' },
      { name: 'update_role', label: 'Atualizar função', category: 'Cargos' },
      { name: 'delete_role', label: 'Deletar função', category: 'Cargos' },

      // Permissions permissions
      { name: 'view_permission', label: 'Visualizar permissão', category: 'Permissões' },
      { name: 'list_permission', label: 'Listar permissões', category: 'Permissões' },
      { name: 'create_permission', label: 'Criar permissão', category: 'Permissões' },
      { name: 'update_permission', label: 'Atualizar permissão', category: 'Permissões' },
      { name: 'delete_permission', label: 'Deletar permissão', category: 'Permissões' },
    ])

    const admin = await Role.findByOrFail('name', 'Administrador')
    await admin.related('permissions').attach(permissions.map((p) => p.id))
  }
}
