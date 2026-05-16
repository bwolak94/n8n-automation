import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed } from "vue";
import MembersPanel from "../MembersPanel.vue";
import type { TenantMember } from "../../../../shared/types/index.js";

// ─── Mock stores ──────────────────────────────────────────────────────────────

const mockTenantStore = {
  tenantId: "tenant-1",
  isOwner: false,
  isAdmin: true,
};

vi.mock("../../../../stores/tenantStore.js", () => ({
  useTenantStore: () => mockTenantStore,
}));

// ─── Mock queries ─────────────────────────────────────────────────────────────

const mockInvite = vi.fn();
const mockUpdateRole = vi.fn();
const mockRemoveMember = vi.fn();
const mockMembersQuery = vi.fn();

vi.mock("../../../../shared/queries/useMembers.js", () => ({
  useMembersQuery: () => mockMembersQuery(),
  useInviteMember: () => ({ mutate: mockInvite, isPending: ref(false) }),
  useUpdateMemberRole: () => ({ mutate: mockUpdateRole }),
  useRemoveMember: () => ({ mutate: mockRemoveMember }),
}));

function makeMember(overrides: Partial<TenantMember> = {}): TenantMember {
  return {
    userId: "user-1",
    email: "alice@example.com",
    role: "editor",
    joinedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MembersPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantStore.isAdmin = true;
    mockTenantStore.isOwner = false;
  });

  it("shows loading skeleton while fetching", () => {
    mockMembersQuery.mockReturnValue({ data: ref(null), isPending: ref(true) });
    const wrapper = mount(MembersPanel);
    expect(wrapper.find(".animate-pulse").exists()).toBe(true);
  });

  it("shows empty state when no members", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    expect(wrapper.text()).toContain("No members yet");
  });

  it("renders member rows", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [makeMember(), makeMember({ userId: "user-2", email: "bob@example.com" })], total: 2, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    expect(wrapper.findAll("[data-testid='member-row']")).toHaveLength(2);
  });

  it("shows invite form for admin", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='invite-form']").exists()).toBe(true);
  });

  it("hides invite form for non-admin", async () => {
    mockTenantStore.isAdmin = false;
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='invite-form']").exists()).toBe(false);
  });

  it("shows validation error for invalid email", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    await wrapper.find("[data-testid='invite-email-input']").setValue("not-an-email");
    await wrapper.find("[data-testid='invite-submit-btn']").trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-testid='invite-error']").exists()).toBe(true);
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("calls inviteMember with valid email", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    await wrapper.find("[data-testid='invite-email-input']").setValue("new@example.com");
    await wrapper.find("[data-testid='invite-submit-btn']").trigger("click");
    expect(mockInvite).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com" }),
      expect.any(Object)
    );
  });

  it("shows role select for admin", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [makeMember({ userId: "u1" })], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='role-select-u1']").exists()).toBe(true);
  });

  it("shows plain role text for non-admin", async () => {
    mockTenantStore.isAdmin = false;
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [makeMember({ userId: "u1", role: "viewer" })], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='role-select-u1']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='member-row']").text()).toContain("viewer");
  });

  it("shows remove button for admin", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [makeMember({ userId: "u1" })], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='remove-member-u1']").exists()).toBe(true);
  });

  it("owner sees owner role in available roles", async () => {
    mockTenantStore.isOwner = true;
    mockTenantStore.isAdmin = true;
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    const roleSelect = wrapper.find("[data-testid='invite-role-select']");
    expect(roleSelect.text()).toContain("owner");
  });

  it("non-owner admin does not see owner role in invite", async () => {
    mockTenantStore.isOwner = false;
    mockTenantStore.isAdmin = true;
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    const roleSelect = wrapper.find("[data-testid='invite-role-select']");
    expect(roleSelect.text()).not.toContain("owner");
  });

  it("calls updateRole when role select changes", async () => {
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [makeMember({ userId: "u1", role: "editor" })], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    const select = wrapper.find("[data-testid='role-select-u1']");
    await select.trigger("change");
    expect(mockUpdateRole).toHaveBeenCalled();
  });

  it("calls removeMember after confirm dialog", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [makeMember({ userId: "u1" })], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    await wrapper.find("[data-testid='remove-member-u1']").trigger("click");
    expect(mockRemoveMember).toHaveBeenCalledWith("u1");
  });

  it("does not call removeMember when confirm is cancelled", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    mockMembersQuery.mockReturnValue({
      data: ref({ items: [makeMember({ userId: "u1" })], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
    });
    const wrapper = mount(MembersPanel);
    await flushPromises();
    await wrapper.find("[data-testid='remove-member-u1']").trigger("click");
    expect(mockRemoveMember).not.toHaveBeenCalled();
  });
});
