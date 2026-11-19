import app from "./app";
import { prisma } from "./lib/prisma";

const PORT = process.env.PORT

const main = async()=>{
    try {
        await prisma.$connect();
        console.log("Connected To The Database Successfully...");

        app.listen(PORT, ()=>{
            console.log(`Server Is Running On Port: ${PORT}`);
            
        })
        
    } catch (error) {
        console.error("Error At Starting The Server:", error)
        await prisma.$disconnect();
        process.exit(1);
    }
};

main();