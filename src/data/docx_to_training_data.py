from docx import Document
import json
import os
import re
def extract_training_examples_from_docx(docx_path, output_jsonl_path, tag="DEFICIENCY"):
    # Load the Word document
    document = Document(docx_path)

    # Prepare storage
    training_data = []


    for table in document.tables:
        for row in table.rows:
            if len(row.cells) >= 2:
                text = row.cells[0].text
                image_info = row.cells[1].text

                # Skip empty entries that dont have text or ones that have image_info (means they dont have picture)
                if not text or image_info:
                    continue


                
                training_data.append({
                    "messages": [
                        {
                            "role": "user",
                            "content":"Write an engineering observation for the following image: {img} \n Tag: TDOD LATER \nDescription: TDOD LATER."
                        },
                        {
                            "role": "assistant",
                            "content": text
                        }
                    ]
                })

    # Save to .jsonl
    with open(output_jsonl_path, "w", encoding="utf-8") as f:
        for entry in training_data:
            #print(entry)
            f.write(json.dumps(entry) + "\n")

    print(f"Saved {len(training_data)} training examples to", output_jsonl_path)


# Example usage:
extract_training_examples_from_docx("./training_word_documents/test_doc_1.docx", "C:/Users/47eva/Documents/Cursor/Pretium/pretium/src/data/dataset1.jsonl")





























    # # Helper: decide if a paragraph marks a split (e.g., new observation)
    # def is_new_section(paragraph):
    #     nonlocal blank_line_count
    #     # Treat two or more consecutive blank lines as section break
    #     if not paragraph.text.strip():
    #         blank_line_count += 1
    #         return False
    #     else:
    #         if blank_line_count >= 2:
    #             blank_line_count = 0
    #             return True
    #         blank_line_count = 0
    #         return False
        
    # def is_relevant_paragraph(paragraph):
    #     numbered_pattern = re.compile(r"^\d+\.\d+")
    #     return numbered_pattern.match(paragraph.text.strip())