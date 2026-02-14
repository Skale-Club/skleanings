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
