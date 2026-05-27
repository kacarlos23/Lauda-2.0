import { NotFoundError } from "../errors/AppError";
import { AdminRepository } from "../repositories/AdminRepository";

export class AdminService {
  constructor(private readonly repository = new AdminRepository()) {}

  listTenants() {
    return this.repository.listTenants();
  }

  async getTenantById(tenantId: string) {
    const tenant = await this.repository.getTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundError("Igreja não encontrada");
    }
    return tenant;
  }

  listUsers(tenantId?: string) {
    return this.repository.listUsers(tenantId);
  }

  listMinistries() {
    return this.repository.listMinistries();
  }
}
