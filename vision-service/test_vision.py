import json
import unittest
from detector import YOLOShelfDetector


class VisionDetectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.detector = YOLOShelfDetector()

    def test_synthetic_normal_vs_low_stock_occupancy(self) -> None:
        normal_bytes, normal_res = self.detector.generate_synthetic_frame("CAM-01", "normal")
        low_bytes, low_res = self.detector.generate_synthetic_frame("CAM-04", "low_stock")

        self.assertGreater(len(normal_bytes), 1000)
        self.assertGreater(len(low_bytes), 1000)
        self.assertEqual(len(normal_res["bounding_boxes"]), 4)
        self.assertEqual(len(low_res["bounding_boxes"]), 4)

        print("NORMAL:", json.dumps({k: normal_res[k] for k in ("shelf_occupancy_pct", "occupied_zones", "confidence_pct", "anomaly_flag", "barcodes")}))
        print("LOW_STOCK:", json.dumps({k: low_res[k] for k in ("shelf_occupancy_pct", "occupied_zones", "confidence_pct", "anomaly_flag", "barcodes")}))

        self.assertGreaterEqual(normal_res["shelf_occupancy_pct"], 75.0)
        self.assertLessEqual(low_res["shelf_occupancy_pct"], 50.0)
        self.assertTrue(low_res["anomaly_flag"])

    def test_analyze_uploaded_jpeg_bytes(self) -> None:
        raw_bytes, _ = self.detector.generate_synthetic_frame("CAM-04", "normal")
        analyzed = self.detector.analyze_image(raw_bytes, camera_id="CAM-04", expected_sku="SKU-OLV-088")
        self.assertEqual(analyzed["sku"], "SKU-OLV-088")
        self.assertEqual(analyzed["engine"], "opencv_cv_pipeline")
        self.assertEqual(analyzed["total_zones"], 4)


if __name__ == "__main__":
    unittest.main()

