import os
import sys
from pathlib import Path
import numpy as np
import json
import matplotlib.pyplot as plt

from sc2 import maps
from sc2.bot_ai import BotAI
from sc2.data import Difficulty, Race, AIBuild, Result
from sc2.ids.unit_typeid import UnitTypeId
from sc2.main import run_game
from sc2.player import Bot, Computer
from sc2.unit import Unit
from sc2.units import Units
from sc2.position import Point2, Point3

class create_grid_bot(BotAI):

    def __init__(self):
        pass

    async def on_start(self):
        self.client.game_step = 2
  
    async def on_step(self, iteration: int):


        if iteration == 0:
            await self.client.debug_show_map()

        if iteration == 2:

            # trim to playable area
            x_margin, y_margin, width, height = self.game_info.playable_area
            placement_map = self.game_info.placement_grid.data_numpy[y_margin:y_margin+height, x_margin:x_margin+width]
            pathing_map = self.game_info.pathing_grid.data_numpy[y_margin:y_margin+height, x_margin:x_margin+width]
            terrain_height = self.game_info.terrain_height.data_numpy[y_margin:y_margin+height, x_margin:x_margin+width]
            placement_map *= pathing_map # cover minerals, geysers, rocks

            # plt.imshow(pathing_map, origin="lower")
            # plt.title("pathing_map")
            # plt.show()   

            # export json file
            map_data = {
                "mapName": self.game_info.map_name,
                "playable_area": {
                    "x_margin": x_margin, # distance from left edge to playable area
                    "y_margin": y_margin, # distance from bottom edge to playable area
                    "width": width, # width of playable area
                    "height": height, # height of playable area
                },                    
                "data": {
                    "placement": placement_map.flatten().tolist(),
                    "pathing": pathing_map.flatten().tolist(),
                    "heights": terrain_height.flatten().tolist()
                }
            }

            import os
            os.makedirs("maps", exist_ok=True)
            with open(f"maps/{self.game_info.map_name}.json", "w") as f:
                json.dump(map_data, f)  

            await self.client.leave()
   
def main():
    run_game(
        maps.get("PersephoneAIE_v4"),
        [Bot(Race.Protoss, create_grid_bot(), name="create_grid_bot"),
        Computer(Race.Terran, Difficulty.Hard, ai_build=AIBuild.Power)] ,        
        realtime=False, 
        random_seed=1,
    )

if __name__ == "__main__":
    main()
 
# 2026
# MagannathaAIE_v2
# UltraloveAIE_v2
# LeyLinesAIE_v3
# TorchesAIE_v4
# PylonAIE_v4
# PersephoneAIE_v4
