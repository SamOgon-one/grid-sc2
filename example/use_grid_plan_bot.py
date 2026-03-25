import os
import sys
from pathlib import Path
import numpy as np
import random
import math
from collections import defaultdict, Counter
from typing import TYPE_CHECKING, Dict, List, Set, Union
from time import perf_counter
import heapq
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

from sc2.ids.ability_id import AbilityId
from sc2.ids.buff_id import BuffId
from sc2.ids.upgrade_id import UpgradeId
from sc2.ids.effect_id import EffectId
from sc2.position import Point2, Point3

from sc2.action import combine_actions

class create_grid_bot(BotAI):

    def __init__(self):
        pass

    async def on_start(self):
        self.client.game_step = 2


  
    async def on_step(self, iteration: int):


        if iteration == 0:
            await self.client.debug_show_map()

        if iteration == 2:

            # open json file from same folder as this file
            with open(f"{os.path.dirname(__file__)}/grid_plan.json", "r") as f:
                map_data = json.load(f)
                
            print(map_data)

                        






   
def main():
    run_game(
        maps.get("LeyLinesAIE_v3"),
        [Bot(Race.Protoss, create_grid_bot(), name="create_grid_bot"),
        Computer(Race.Terran, Difficulty.Hard, ai_build=AIBuild.Power)] ,        
        realtime=False, 
        random_seed=1,
    )

if __name__ == "__main__":
    main()
 
# 2025
# MagannathaAIE_v2
# UltraloveAIE_v2
# LeyLinesAIE_v3
# TorchesAIE_v4
# PylonAIE_v4
# PersephoneAIE_v4
