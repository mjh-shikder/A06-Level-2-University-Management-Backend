import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpstatus from "http-status";


const register = catchAsync(async (req: Request, res: Response)=>{

    sendResponse(res,{
        statusCode: httpstatus.OK,
        success: true,
        message: "Testing the auth route",
        data: null
    })
})


export const AuthController = {
    register
}