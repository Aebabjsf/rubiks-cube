from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from .utils import generate_wca_scramble
from .models import DuelMatch


class DuelTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_wca_scramble_generator(self):
        scramble = generate_wca_scramble(20)
        moves = scramble.split()
        self.assertEqual(len(moves), 20)
        # Проверяем, что нет повторов одного слоя подряд
        for i in range(len(moves) - 1):
            face1 = moves[i][0]
            face2 = moves[i + 1][0]
            self.assertNotEqual(face1, face2)

    def test_create_and_list_duel_rooms(self):
        create_res = self.client.post('/api/duels/create/')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertIn('room_code', create_res.data)
        self.assertIn('scramble', create_res.data)

        list_res = self.client.get('/api/duels/rooms/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertIn('active_rooms', list_res.data)
        self.assertTrue(any(r['code'] == create_res.data['room_code'] for r in list_res.data['active_rooms']))

    def test_match_model(self):
        match = DuelMatch.objects.create(
            room_code="TEST99",
            player1_name="Алексей",
            player2_name="Максим",
            scramble="R U R' U'",
            player1_time=15.2,
            player2_time=14.1,
            winner_name="Максим",
            status="finished"
        )
        self.assertEqual(match.winner_name, "Максим")
        self.assertEqual(match.status, "finished")
