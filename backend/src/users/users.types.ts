// Input shapes the users service works with. Controllers validate requests with
// DTO classes and pass the validated data in as these plain interfaces, so the
// service layer doesn't depend on the HTTP/transport types.

export interface CreateUserInput {
  name: string;
  phone: string;
  email: string;
}
