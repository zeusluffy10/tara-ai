export type RootStackParamList = {
  SeniorModeHome: undefined;
  VoiceRecorder: undefined;
  VoiceConfirm: { text: string };
  SearchNavigateFlow: { initialQuery?: string; origin?: string } | undefined;
  NavigationMapScreen: { routeData: any };
  VoiceSettings: undefined;
};
