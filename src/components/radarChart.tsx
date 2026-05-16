import React from "react"
import { Dimensions, View } from "react-native"
import { RadarChart } from "react-native-chart-kit"

const screenWidth = Dimensions.get("window").width

export default function SkinRadarChart() {
  return (
    <View style={{ alignItems: "center", marginBottom: 20 }}>
      <RadarChart
        data={{
          labels: ["Hydration", "Oil", "Sensitivity", "Brightness"],
          datasets: [
            {
              data: [72, 45, 60, 80],
            },
          ],
        }}
        width={screenWidth - 60}
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          color: () => "#6c5ce7",
          labelColor: () => "#555",
        }}
        style={{
          borderRadius: 16,
        }}
      />
    </View>
  )
}