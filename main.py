import tkinter as tk
from tkinter import ttk, messagebox, simpledialog

class Note:
    def __init__(self, title, content=""):
        self.title = title
        self.content = content

class ProjectScribeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Project Scribe")
        self.notes = []
        self.current_note = None

        # Set up main frames: note list and editor
        self.setup_ui()

    def setup_ui(self):
        # Main container, using a paned window to separate list and editor
        paned = ttk.PanedWindow(self.root, orient='horizontal')
        paned.pack(fill='both', expand=True)

        # Left frame for the note list with new and delete controls
        self.list_frame = ttk.Frame(paned, width=200)
        paned.add(self.list_frame, weight=1)
        self.setup_list_frame()

        # Right frame for the note editor
        self.editor_frame = ttk.Frame(paned)
        paned.add(self.editor_frame, weight=4)
        self.setup_editor_frame()

    def setup_list_frame(self):
        # List label
        label = ttk.Label(self.list_frame, text="Notes", font=("Helvetica", 14))
        label.pack(pady=5)

        # Listbox widget to display note titles
        self.note_listbox = tk.Listbox(self.list_frame, height=20)
        self.note_listbox.pack(fill='both', expand=True, padx=10)
        self.note_listbox.bind("<<ListboxSelect>>", self.on_note_select)

        # Frame for buttons
        btn_frame = ttk.Frame(self.list_frame)
        btn_frame.pack(pady=5)

        # Button to create a new note
        new_btn = ttk.Button(btn_frame, text="New Note", command=self.new_note)
        new_btn.pack(side='left', padx=2)

        # Button to delete the selected note
        del_btn = ttk.Button(btn_frame, text="Delete Note", command=self.delete_note)
        del_btn.pack(side='left', padx=2)

    def setup_editor_frame(self):
        # Text widget for editing note content
        self.text_editor = tk.Text(self.editor_frame, wrap='word', font=("Arial", 12))
        self.text_editor.pack(fill='both', expand=True, padx=10, pady=10)
        self.text_editor.bind("<KeyRelease>", self.on_text_change)

    def new_note(self):
        title = simpledialog.askstring("New Note", "Enter note title:")
        if title:
            # Save current note if any changes
            self.save_current_note()

            # Create and add new note.
            note = Note(title)
            self.notes.append(note)
            self.note_listbox.insert(tk.END, title)
            # Clear editor
            self.text_editor.delete("1.0", tk.END)
            self.current_note = note

    def delete_note(self):
        selection = self.note_listbox.curselection()
        if not selection:
            messagebox.showinfo("Delete Note", "No note selected.")
            return

        index = selection[0]
        confirm = messagebox.askyesno("Delete Note", "Are you sure you want to delete this note?")
        if confirm:
            del self.notes[index]
            self.note_listbox.delete(index)
            # Clear editor if the deleted note was current.
            if self.current_note and index < len(self.notes) and self.current_note.title == self.notes[index].title:
                self.text_editor.delete("1.0", tk.END)
                self.current_note = None

    def on_note_select(self, event):
        if not self.note_listbox.curselection():
            return
        index = self.note_listbox.curselection()[0]

        # Save current note before switching
        self.save_current_note()

        self.current_note = self.notes[index]
        # Set text editor content to the note's content.
        self.text_editor.delete("1.0", tk.END)
        self.text_editor.insert(tk.END, self.current_note.content)

    def on_text_change(self, event):
        # Automatically update note content on any text change
        if self.current_note:
            self.current_note.content = self.text_editor.get("1.0", tk.END).rstrip()

    def save_current_note(self):
        # Optionally implement persistent storage here.
        if self.current_note:
            self.current_note.content = self.text_editor.get("1.0", tk.END).rstrip()

def main():
    root = tk.Tk()
    root.geometry("800x600")
    app = ProjectScribeApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()