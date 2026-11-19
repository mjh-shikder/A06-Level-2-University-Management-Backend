import { Router } from "express";
import { AuthController } from "./auth.controller";


const router = Router()

router.get("/test", AuthController.register)


export const AuthRoutes = router;