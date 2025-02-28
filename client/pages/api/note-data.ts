import { CLI_PATH } from "@/consts/cli-path";
import { midenSync } from "@/helpers/miden-sync";
import { runCommand } from "@/helpers/run-command";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const noteId = req.query.noteId as string;
  await Promise.all([await midenSync()]);

  const parseNoteFields = (input: string) => {
    const fieldNames = [
      "ID",
      "Script Hash",
      "Assets Hash",
      "Inputs Hash",
      "Serial Number",
      "Type",
      "Status",
      "Tag",
      "Sender",
      "Exportable",
    ];

    const regex = new RegExp(`(${fieldNames.join("|")})\\s+(.+)$`, "gm");

    const result: { [key: string]: string } = {};
    let match;

    while ((match = regex.exec(input)) !== null) {
      const key = match[1];
      const value = match[2].trim();
      result[key] = value;
    }

    return result;
  };

  const extractCode = (input: string): string[] => {
    const lines = input.trim().split("\n");
    const filteredLines = lines
      .filter((line) => !/^[-\s]*$/.test(line))
      .filter((line) => !line.includes("══════"))
      .filter((line) => !line.includes("──────"));

    return filteredLines;
  };

  const parseLast = (test: string) => {
    const [front, back] = test.split("Note Inputs");
    const parseStringToObject = (input: string) => {
      const lines = input.trim().split("\n");
      const headers = lines[1].trim().split(/\s{2,}/);
      const dataRows = lines
        .slice(3, lines.length - 1)
        .map((line) => line.trim().split(/\s{2,}/));

      const result = dataRows.map((row) => {
        const entry: { [key: string]: string | number } = {};
        headers.forEach((header, index) => {
          entry[header] = isNaN(Number(row[index]))
            ? row[index]
            : Number(row[index]);
        });
        return entry;
      });

      return result;
    };

    const firstHalf = parseStringToObject(front).filter(
      (item) => item["Type"] && item["Faucet ID"] && item["Amount"]
    )[0];

    const parseValuesString = (input: string) => {
      const lines = input.trim().split("\n");
      const headers = lines[1].trim().split(/\s{2,}/);
      const dataRows = lines
        .slice(3, lines.length - 1)
        .map((line) => line.trim().split(/\s{2,}/));

      const result = dataRows.map((row) => {
        const entry: { [key: string]: string | number } = {};
        headers.forEach((header, index) => {
          entry[header] = isNaN(Number(row[index]))
            ? row[index]
            : Number(row[index]);
        });
        return entry;
      });

      return result;
    };

    const backHalf = parseValuesString(back)[0];

    return { ...firstHalf, ...backHalf };
  };

  const parseNoteInformation = (input: string) => {
    const [first, leftover] = input.split("Note Script Code");
    const fields = parseNoteFields(first);

    const [second, leftover2] = leftover.split("Note Assets");

    const code = extractCode(second);

    const stub = parseLast(leftover2);

    return { ...fields, code, ...stub };
  };

  const command = await runCommand(
    `${CLI_PATH} miden notes --show ${noteId}`,
    parseNoteInformation
  );

  res.status(200).json({ notes: command });
}
