import { Router } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
});

router.post("/", requireAdmin, async (req, res) => {
    // Validation logic...
    const newUser = await storage.createUser(req.body);
    res.status(201).json(newUser);
});

router.patch("/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    const updates = req.body;
    
    // Check if we are demoting an admin
    if (updates.isAdmin === false) {
        const user = await storage.getUser(id);
        if (user && user.isAdmin) {
            const users = await storage.getUsers();
            const adminCount = users.filter(u => u.isAdmin).length;
            if (adminCount <= 1) {
                return res.status(400).json({ message: "Cannot remove the last administrator." });
            }
        }
    }

    const updated = await storage.updateUser(id, updates);
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
    
    if (user && user.isAdmin) {
        const users = await storage.getUsers();
        const adminCount = users.filter(u => u.isAdmin).length;
        if (adminCount <= 1) {
             return res.status(400).json({ message: "Cannot delete the last administrator." });
        }
    }

    await storage.deleteUser(id);
    res.status(204).send();
});

export default router;
