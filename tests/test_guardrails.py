import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import check_mongoose_patterns as checker
import verify_mongo_kit as verifier


class GuardrailTests(unittest.TestCase):
    def test_kit_metadata(self):
        self.assertEqual(verifier.validate(ROOT), [])

    def test_flags_direct_model_access_from_controller(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'src/controllers/patientController.ts'
            path.parent.mkdir(parents=True)
            path.write_text('import Patient from "../models/Patient";\n')
            issues = checker.inspect_file(path, root)
            self.assertTrue(any(label == 'layer-boundary' and level == 'HIGH' for level, _, label, _ in issues))

    def test_no_issues_for_plain_service(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'src/services/patientService.ts'
            path.parent.mkdir(parents=True)
            path.write_text('export const example = (x: number) => x + 1;\n')
            self.assertEqual(checker.inspect_file(path, root), [])


if __name__ == '__main__':
    unittest.main()
