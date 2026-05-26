import { memberService } from "./memberService";
import { api } from "./api";
import { Member } from "../types";

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("memberService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("listMembers mantem instruments retornados pela API", async () => {
    const members: Member[] = [
      {
        id: "member-1",
        name: "Ana",
        email: "ana@example.com",
        role: "MEMBER",
        tenantId: "tenant-1",
        instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
        ministries: [],
      },
    ];
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: members } });

    const result = await memberService.listMembers();

    expect(result).toEqual(members);
    expect(mockedApi.get).toHaveBeenCalledWith("/members");
    expect(result[0]?.instruments?.[0]?.name).toBe("Teclado");
  });
});
