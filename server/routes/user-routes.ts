import { Router } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
});

router.post("/", requireAdmin, async (req, res) => {
    const newUser = await storage.createUser(req.body);

    // Bridge: if role=staff, auto-create linked staffMembers record
    if (newUser.role === 'staff') {
        const created = await storage.createStaffMember({
            firstName: newUser.firstName || '',
            lastName: newUser.lastName || '',
            email: newUser.email || undefined,
            phone: newUser.phone || undefined,
            profileImageUrl: newUser.profileImageUrl || undefined,
            isActive: true,
            order: 0,
        });
        await storage.linkStaffMemberToUser(created.id, newUser.id);
    }

    res.status(201).json(newUser);
});

router.patch("/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    const updates = req.body;

    // Prevent demoting the last admin
    if (updates.role && updates.role !== 'admin') {
        const user = await storage.getUser(id);
        if (user && user.role === 'admin') {
            const users = await storage.getUsers();
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({ message: "Cannot remove the last administrator." });
            }
        }
    }

    const updated = await storage.updateUser(id, updates);

    // Bridge: if role changed to staff and no staffMember linked yet, create one
    if (updates.role === 'staff') {
        const existing = await storage.getStaffMemberByUserId(updated.id);
        if (!existing) {
            const created = await storage.createStaffMember({
                firstName: updated.firstName || '',
                lastName: updated.lastName || '',
                email: updated.email || undefined,
                phone: updated.phone || undefined,
                profileImageUrl: updated.profileImageUrl || undefined,
                isActive: true,
                order: 0,
            });
            await storage.linkStaffMemberToUser(created.id, updated.id);
        }
    }

    res.json(updated);
});

// PATCH /api/users/:id/staff-link — links/unlinks user to a staff member
router.patch("/:id/staff-link", requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { staffMemberId } = req.body;
        if (staffMemberId !== null && staffMemberId !== undefined) {
            await storage.linkStaffToUser(Number(staffMemberId), userId);
        } else {
            // Clear any existing link by setting userId=null on any linked staff member
            const allStaff = await storage.getStaffMembers(true);
            const linked = allStaff.find(s => s.userId === userId);
            if (linked) {
                await storage.linkStaffToUser(linked.id, null as any);
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.delete("/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    const user = await storage.getUser(id);

    if (user && user.role === 'admin') {
        const users = await storage.getUsers();
        const adminCount = users.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
            return res.status(400).json({ message: "Cannot delete the last administrator." });
        }
    }

    // Clean up linked staffMembers record to avoid FK constraint violation
    const linkedStaff = await storage.getStaffMemberByUserId(id);
    if (linkedStaff) {
        await storage.deleteStaffMember(linkedStaff.id);
    }

    await storage.deleteUser(id);
    res.status(204).send();
});

export default router;
