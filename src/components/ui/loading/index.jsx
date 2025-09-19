import { Oval } from 'react-loader-spinner';

export function LoadingSpinner() {
  let loadingColor = '#34495E';
  let loadingBackgroundColor = '#2C3E50';
  return (
    <Oval
      color={loadingColor}
      secondaryColor={loadingBackgroundColor}
      wrapperStyle={{
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2000,
      }}
    />
  );
}
