import express from "express";
import cors from "cors";
import { iamRouter } from "./modules/iam";

// Module routers — se implementează câte unul pe sprint (vezi Roadmap_Demo_Scenarii.html)
// import { dmsRouter } from "./modules/dms";
// import { biRouter } from "./modules/bi";
// import { chatbotRouter } from "./modules/chatbot";
// import { lmsRouter } from "./modules/lms";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", scenarios: ["iam", "dms", "bi", "chatbot", "lms"] });
});

app.use("/api/iam", iamRouter);
// app.use("/api/dms", dmsRouter);
// app.use("/api/bi", biRouter);
// app.use("/api/chatbot", chatbotRouter);
// app.use("/api/lms", lmsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ANS demo backend ascultă pe portul ${port}`));
