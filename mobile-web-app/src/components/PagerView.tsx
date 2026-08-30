import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, ScrollView, View } from 'react-native';

export interface CrossPagerRef {
  setPage: (index: number) => void;
}

interface CrossPagerProps {
  initialPage: number;
  onPageSelected: (e: { nativeEvent: { position: number } }) => void;
  children: React.ReactNode;
  style?: any;
}

const CrossPager = forwardRef<CrossPagerRef, CrossPagerProps>(
  ({ initialPage, onPageSelected, children, style }, ref) => {
    const scrollRef = useRef<ScrollView>(null);
    const [width, setWidth] = useState(Dimensions.get('window').width);
    const childArray = Array.isArray(children) ? children : [children];

    useImperativeHandle(ref, () => ({
      setPage: (index: number) => {
        scrollRef.current?.scrollTo({ x: index * width, animated: true });
      },
    }));

    const handleScroll = (e: any) => {
      const offset = e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / width);
      onPageSelected({ nativeEvent: { position: index } });
    };

    return (
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={style}
      >
        {childArray.map((child, index) => (
          <View key={index} style={{ width }}>
            {child}
          </View>
        ))}
      </ScrollView>
    );
  }
);

export default CrossPager;
