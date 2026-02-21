import runpy
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PYC_PATH = ROOT / "__pycache__" / "backend.cpython-312.pyc"

sys.path.insert(0, str(ROOT))
runpy.run_path(str(PYC_PATH), run_name="__main__")

