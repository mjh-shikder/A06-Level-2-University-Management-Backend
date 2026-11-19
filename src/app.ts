import express, { type Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config";
import { AuthRoutes } from "./module/auth/auth.route";

const app: Application = express();

app.use(cors({
		origin: config.frontend_url,
		credentials: true,
	}));
app.use(express.urlencoded({ extended: true }));

app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/v1/auth", AuthRoutes)

export default app;