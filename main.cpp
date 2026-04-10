#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <map>
#include <string>
#include <algorithm>
#include <iomanip>
#include <stdexcept>

using namespace std;

// ─────────────────────────────────────────────
//  CLASS: Student
// ─────────────────────────────────────────────
class Student {
private:
    string regNo;
    string name;
    map<string, char> attendanceRecord; // date -> 'P' or 'A'

public:
    // Constructor
    Student(const string& reg, const string& nm)
        : regNo(reg), name(nm) {}

    // Getters
    string getRegNo() const { return regNo; }
    string getName()  const { return name;  }

    // Mark attendance for a date (P/A only)
    bool markAttendance(const string& date, char status) {
        status = toupper(status);
        if (status != 'P' && status != 'A') return false;
        attendanceRecord[date] = status;
        return true;
    }

    // Get attendance for a specific date
    char getAttendance(const string& date) const {
        auto it = attendanceRecord.find(date);
        if (it != attendanceRecord.end()) return it->second;
        return '\0';
    }

    // Total classes held
    int totalClasses() const {
        return (int)attendanceRecord.size();
    }

    // Classes present
    int presentCount() const {
        int cnt = 0;
        for (auto& kv : attendanceRecord)
            if (kv.second == 'P') cnt++;
        return cnt;
    }

    // Attendance percentage
    double attendancePercent() const {
        if (attendanceRecord.empty()) return 0.0;
        return (presentCount() * 100.0) / totalClasses();
    }

    // Get full record map
    const map<string, char>& getRecord() const {
        return attendanceRecord;
    }

    // Serialise to string for file storage
    string serialize() const {
        ostringstream oss;
        oss << regNo << "," << name << ";";
        for (auto& kv : attendanceRecord)
            oss << kv.first << ":" << kv.second << "|";
        return oss.str();
    }

    // Deserialise from stored string
    static Student deserialize(const string& line) {
        size_t semi = line.find(';');
        string header = line.substr(0, semi);
        string records = line.substr(semi + 1);

        size_t comma = header.find(',');
        string reg = header.substr(0, comma);
        string nm  = header.substr(comma + 1);

        Student s(reg, nm);
        size_t pos = 0;
        while (pos < records.size()) {
            size_t pipe  = records.find('|', pos);
            if (pipe == string::npos) break;
            string entry = records.substr(pos, pipe - pos);
            size_t colon = entry.find(':');
            if (colon != string::npos) {
                string date   = entry.substr(0, colon);
                char   status = entry[colon + 1];
                s.attendanceRecord[date] = status;
            }
            pos = pipe + 1;
        }
        return s;
    }
};

// ─────────────────────────────────────────────
//  CLASS: AttendanceManager
// ─────────────────────────────────────────────
class AttendanceManager {
private:
    vector<Student> students;
    string dataFile;

    // Find student index by regNo (-1 if not found)
    int findIndex(const string& regNo) const {
        for (int i = 0; i < (int)students.size(); i++)
            if (students[i].getRegNo() == regNo) return i;
        return -1;
    }

public:
    AttendanceManager(const string& file = "attendance.dat")
        : dataFile(file) {
        loadFromFile();
    }

    // ── CRUD ──

    bool addStudent(const string& regNo, const string& name) {
        // Validate no duplicates
        if (findIndex(regNo) != -1) return false;
        students.emplace_back(regNo, name);
        saveToFile();
        return true;
    }

    bool removeStudent(const string& regNo) {
        int idx = findIndex(regNo);
        if (idx == -1) return false;
        students.erase(students.begin() + idx);
        saveToFile();
        return true;
    }

    // ── Attendance ──

    bool markAttendance(const string& regNo,
                        const string& date, char status) {
        int idx = findIndex(regNo);
        if (idx == -1) return false;
        if (!students[idx].markAttendance(date, status)) return false;
        saveToFile();
        return true;
    }

    // Mark full class for a date from a list of statuses
    // statuses: vector of pairs (regNo, P/A)
    void markClassAttendance(const string& date,
                             const vector<pair<string,char>>& entries) {
        for (auto& e : entries)
            markAttendance(e.first, date, e.second);
    }

    // ── Queries ──

    const Student* getStudent(const string& regNo) const {
        int idx = findIndex(regNo);
        if (idx == -1) return nullptr;
        return &students[idx];
    }

    const vector<Student>& getAllStudents() const {
        return students;
    }

    // Students below threshold %
    vector<const Student*> getBelowThreshold(double threshold = 75.0) const {
        vector<const Student*> result;
        for (auto& s : students)
            if (s.attendancePercent() < threshold)
                result.push_back(&s);
        return result;
    }

    // Class average attendance %
    double classAverage() const {
        if (students.empty()) return 0.0;
        double total = 0.0;
        for (auto& s : students) total += s.attendancePercent();
        return total / students.size();
    }

    int studentCount() const { return (int)students.size(); }

    // ── Persistence ──

    void saveToFile() const {
        ofstream ofs(dataFile);
        if (!ofs) {
            cerr << "[ERROR] Cannot write to " << dataFile << "\n";
            return;
        }
        for (auto& s : students)
            ofs << s.serialize() << "\n";
    }

    void loadFromFile() {
        ifstream ifs(dataFile);
        if (!ifs) return; // first run, no file yet
        string line;
        while (getline(ifs, line)) {
            if (!line.empty()) {
                try {
                    students.push_back(Student::deserialize(line));
                } catch (...) {
                    cerr << "[WARN] Skipping corrupt record\n";
                }
            }
        }
    }
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
void printHeader(const string& title) {
    cout << "\n╔══════════════════════════════════════╗\n";
    cout << "║  " << left << setw(36) << title << "║\n";
    cout << "╚══════════════════════════════════════╝\n";
}

void printMenu() {
    printHeader("ATTENDANCE MANAGER");
    cout << "  1. Add Student\n";
    cout << "  2. Mark Attendance\n";
    cout << "  3. View Student Summary\n";
    cout << "  4. View All Students\n";
    cout << "  5. Shortage Report (<75%)\n";
    cout << "  6. Class Average Attendance\n";
    cout << "  7. Remove Student\n";
    cout << "  0. Exit\n";
    cout << "\nEnter choice: ";
}

// ─────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────
int main() {
    AttendanceManager manager("attendance.dat");
    int choice;

    do {
        printMenu();
        if (!(cin >> choice)) {
            cin.clear();
            cin.ignore(1000, '\n');
            choice = -1;
        }
        cin.ignore(1000, '\n');

        switch (choice) {

        case 1: { // Add student
            string reg, name;
            cout << "Enter RegNo: ";  getline(cin, reg);
            cout << "Enter Name: ";   getline(cin, name);
            if (reg.empty() || name.empty()) {
                cout << "[ERROR] Fields cannot be empty.\n"; break;
            }
            if (manager.addStudent(reg, name))
                cout << "[OK] Student added.\n";
            else
                cout << "[ERROR] RegNo already exists.\n";
            break;
        }

        case 2: { // Mark attendance
            string reg, date;
            char status;
            cout << "Enter RegNo: ";  getline(cin, reg);
            cout << "Enter Date (YYYY-MM-DD): "; getline(cin, date);
            cout << "Status (P/A): "; cin >> status; cin.ignore();
            if (manager.markAttendance(reg, date, status))
                cout << "[OK] Attendance marked.\n";
            else
                cout << "[ERROR] Invalid input or student not found.\n";
            break;
        }

        case 3: { // View student summary
            string reg;
            cout << "Enter RegNo: "; getline(cin, reg);
            const Student* s = manager.getStudent(reg);
            if (!s) { cout << "[ERROR] Student not found.\n"; break; }
            printHeader("Student Summary: " + s->getName());
            cout << "  RegNo  : " << s->getRegNo()         << "\n";
            cout << "  Classes: " << s->totalClasses()     << "\n";
            cout << "  Present: " << s->presentCount()     << "\n";
            cout << "  Absent : " << s->totalClasses() - s->presentCount() << "\n";
            cout << fixed << setprecision(1);
            cout << "  %      : " << s->attendancePercent() << "%\n";
            cout << "\n  Date-wise record:\n";
            for (auto& kv : s->getRecord())
                cout << "    " << kv.first << " : " << kv.second << "\n";
            break;
        }

        case 4: { // All students
            printHeader("All Students");
            if (manager.studentCount() == 0) { cout << "  No students yet.\n"; break; }
            cout << left << setw(14) << "RegNo"
                 << setw(22) << "Name"
                 << setw(8)  << "Classes"
                 << setw(8)  << "Present"
                 << "Percent\n";
            cout << string(60, '-') << "\n";
            for (auto& s : manager.getAllStudents()) {
                cout << setw(14) << s.getRegNo()
                     << setw(22) << s.getName()
                     << setw(8)  << s.totalClasses()
                     << setw(8)  << s.presentCount()
                     << fixed << setprecision(1)
                     << s.attendancePercent() << "%\n";
            }
            break;
        }

        case 5: { // Shortage report
            printHeader("Shortage Report (<75%)");
            auto shortage = manager.getBelowThreshold(75.0);
            if (shortage.empty()) { cout << "  No students below 75%.\n"; break; }
            for (auto* s : shortage) {
                cout << "  " << left << setw(14) << s->getRegNo()
                     << setw(22) << s->getName()
                     << fixed << setprecision(1)
                     << s->attendancePercent() << "%\n";
            }
            break;
        }

        case 6: { // Class average
            cout << fixed << setprecision(2);
            cout << "\n  Class Average Attendance: "
                 << manager.classAverage() << "%\n";
            break;
        }

        case 7: { // Remove student
            string reg;
            cout << "Enter RegNo to remove: "; getline(cin, reg);
            if (manager.removeStudent(reg))
                cout << "[OK] Student removed.\n";
            else
                cout << "[ERROR] Student not found.\n";
            break;
        }

        case 0:
            cout << "\n  Goodbye!\n\n";
            break;

        default:
            cout << "[ERROR] Invalid choice.\n";
        }

    } while (choice != 0);

    return 0;
}
