"""Geometry regression: the hand and its sleeve must share one transform."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools/sprite-rig"))
import painted_priest as priest


class PriestHandTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sheet = priest.Image.open(priest.SOURCE).convert("RGBA")

    def test_hand_uses_front_sleeve_transform_in_every_pose(self):
        for gender in ("male", "female"):
            for branch in ("novice", "bishop", "templar"):
                art = priest.extract(self.sheet, gender, branch)
                for action, (poses, *_rest) in priest.priest_actions().items():
                    for frame, p in enumerate(poses):
                        with self.subTest(gender=gender, branch=branch, action=action, frame=frame):
                            s = priest.skeleton(p)
                            with patch.object(priest, "paint") as painted:
                                priest.outfit_frame(art, s, p)
                                sleeve = next(call.args for call in painted.call_args_list
                                              if call.args[1] is art["parts"]["fore-front"])
                            with patch.object(priest, "paint") as painted:
                                priest.body_frame(art, s, p, hand_only=True)
                                self.assertEqual(painted.call_count, 1)
                                hand = painted.call_args.args
                            self.assertIs(hand[1], art["parts"]["hand-front"])
                            self.assertEqual(hand[2:], sleeve[2:])

    def test_base_body_does_not_draw_duplicate_hands(self):
        art = priest.extract(self.sheet, "female", "novice")
        p = priest.priest_actions()["walk"][0][2]
        with patch.object(priest, "paint") as painted:
            priest.body_frame(art, priest.skeleton(p), p)
            self.assertEqual(painted.call_count, 2)
            for call in painted.call_args_list:
                self.assertTrue(any(call.args[1] is art["parts"][f"boot-{side}"]
                                    for side in ("back", "front")))

    def test_forearm_cut_keeps_fingers_without_copying_the_upper_arm(self):
        image = priest.Image.new("RGBA", (100, 100), (200, 180, 150, 255))
        piece = priest.limb_mask(image, (50, 50), (50, 80), 12, 10,
                                extend=0.46, start_extend=0.04)
        self.assertEqual(piece.getpixel((50, 30))[3], 0, "upper arm must not rotate again with the forearm")
        self.assertEqual(piece.getpixel((50, 90))[3], 255, "fingers must remain beyond the wrist")

    def test_walking_and_running_palms_never_trade_sides_of_the_torso(self):
        for action in ("walk", "run"):
            for frame, pose in enumerate(priest.priest_actions()[action][0]):
                with self.subTest(action=action, frame=frame):
                    s = priest.skeleton(pose)
                    self.assertGreater(s["arm_f"][2][0], s["top"][0])
                    self.assertLess(s["arm_b"][2][0], s["top"][0])

    def test_free_hand_stays_below_waist_and_near_its_shoulder_during_gait(self):
        for action in ("walk", "run"):
            for pose in priest.priest_actions()[action][0]:
                s = priest.skeleton(pose)
                shoulder, elbow, hand = s["arm_b"]
                self.assertLess(abs(hand[0] - shoulder[0]), 8,
                                "free arm must not sweep behind the back")
                self.assertGreater(hand[1] - shoulder[1], 38,
                                   "free elbow must hang relaxed instead of curling up")
                self.assertLess(abs(s["arm_f"][2][0] - s["arm_f"][0][0]), 14,
                                "staff-carrying arm must not use the running swing")

    def test_carrier_arm_is_below_robe_and_free_arm_is_above_robe(self):
        for gender in ("male", "female"):
            for branch in ("novice", "bishop", "templar"):
                art = priest.extract(self.sheet, gender, branch)
                for action in ("idle", "walk", "run", "attack", "skill"):
                    for p in priest.priest_actions()[action][0]:
                        with patch.object(priest, "paint") as painted:
                            priest.outfit_frame(art, priest.skeleton(p), p)
                            names = [next(k for k, v in art["parts"].items() if call.args[1] is v)
                                     for call in painted.call_args_list]
                        self.assertEqual(names, ["upper-front", "fore-front", "torso", "upper-back", "fore-back"])


if __name__ == "__main__":
    unittest.main()
