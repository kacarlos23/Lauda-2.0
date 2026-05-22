import { ministryApi } from "./ministryApi";
import { api } from "./api";

jest.mock("./api", () => ({
  api: {
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("ministryApi.toggleMinistryMember", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("chama endpoint correto e envia payload esperado", async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { success: true, data: { status: "linked", member_id: "member-1", ministry_id: "ministry-1" } },
    });

    await expect(ministryApi.toggleMinistryMember("ministry-1", "member-1")).resolves.toEqual({
      status: "linked",
      member_id: "member-1",
      ministry_id: "ministry-1",
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/ministries/ministry-1/toggle-member", {
      member_id: "member-1",
    });
  });

  it("interpreta resposta unlinked", async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { success: true, data: { status: "unlinked", member_id: "member-1", ministry_id: "ministry-1" } },
    });

    await expect(ministryApi.toggleMinistryMember("ministry-1", "member-1")).resolves.toMatchObject({
      status: "unlinked",
    });
  });

  it("converte erro da API em mensagem amigavel", async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: { error: "Apenas administradores da igreja podem gerenciar vinculos" } },
    });

    await expect(ministryApi.toggleMinistryMember("ministry-1", "member-1")).rejects.toThrow(
      "Apenas administradores da igreja podem gerenciar vinculos"
    );
  });
});
