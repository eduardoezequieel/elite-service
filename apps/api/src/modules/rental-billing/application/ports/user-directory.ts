/** Los nombres de quien cobró o anuló (098). Un id que ya no existe no viene. */
export interface UserDirectory {
  namesOf(ids: readonly string[]): Promise<Map<string, string>>;
}

export const USER_DIRECTORY = Symbol('rental-billing.UserDirectory');
